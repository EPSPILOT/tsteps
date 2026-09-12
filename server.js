import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

process.env.TZ=process.env.TZ||'Africa/Casablanca';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=process.env.PORT||3000;
const DB_DIR=path.join(__dirname,'data'); fs.mkdirSync(DB_DIR,{recursive:true});
const db=new DatabaseSync(path.join(DB_DIR,'eps_pilot.sqlite'));
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS institutions(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT UNIQUE,directorate TEXT,region TEXT,subscription_status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('teacher','coordinator','inspector','owner')),full_name TEXT NOT NULL,email TEXT,phone TEXT,institution_id TEXT REFERENCES institutions(id),active INTEGER DEFAULT 1,force_password_change INTEGER DEFAULT 0,onboarding_complete INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS inspector_institutions(inspector_id TEXT NOT NULL REFERENCES users(id),institution_id TEXT NOT NULL REFERENCES institutions(id),status TEXT DEFAULT 'active',PRIMARY KEY(inspector_id,institution_id));
CREATE TABLE IF NOT EXISTS teacher_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),gender TEXT,dob TEXT,grade TEXT,specialization TEXT,payroll_number TEXT UNIQUE,seniority TEXT,photo_path TEXT,professional_summary TEXT);
CREATE TABLE IF NOT EXISTS professional_documents(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),title TEXT,category TEXT,description TEXT,file_path TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS professional_access_requests(id TEXT PRIMARY KEY,teacher_id TEXT REFERENCES users(id),inspector_id TEXT REFERENCES users(id),status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP,decided_at TEXT);
CREATE TABLE IF NOT EXISTS classes(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id),name TEXT NOT NULL,level TEXT,year_label TEXT,teacher_id TEXT REFERENCES users(id),active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY,class_id TEXT REFERENCES classes(id),massar_number TEXT UNIQUE NOT NULL,first_name TEXT,last_name TEXT,dob TEXT,gender TEXT,photo_path TEXT,health_note TEXT,eps_note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS annual_plans(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id),teacher_id TEXT REFERENCES users(id),title TEXT,school_year TEXT,status TEXT DEFAULT 'draft',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS units(id TEXT PRIMARY KEY,plan_id TEXT REFERENCES annual_plans(id),class_id TEXT REFERENCES classes(id),sport TEXT,title TEXT,session_count INTEGER,duration_minutes INTEGER,objective TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,unit_id TEXT REFERENCES units(id),class_id TEXT REFERENCES classes(id),teacher_id TEXT REFERENCES users(id),session_date TEXT,start_time TEXT,end_time TEXT,objective TEXT,content TEXT,status TEXT DEFAULT 'planned',reason TEXT,started_at TEXT,ended_at TEXT,logbook_entry_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS attendance(id TEXT PRIMARY KEY,session_id TEXT REFERENCES sessions(id),student_id TEXT REFERENCES students(id),status TEXT,remark TEXT,UNIQUE(session_id,student_id));
CREATE TABLE IF NOT EXISTS assessments(id TEXT PRIMARY KEY,class_id TEXT REFERENCES classes(id),unit_id TEXT REFERENCES units(id),teacher_id TEXT REFERENCES users(id),assessment_date TEXT,type TEXT,criterion TEXT,scale REAL DEFAULT 20,title TEXT);
CREATE TABLE IF NOT EXISTS assessment_results(id TEXT PRIMARY KEY,assessment_id TEXT REFERENCES assessments(id),student_id TEXT REFERENCES students(id),score REAL,remark TEXT,UNIQUE(assessment_id,student_id));
CREATE TABLE IF NOT EXISTS logbook_entries(id TEXT PRIMARY KEY,teacher_id TEXT REFERENCES users(id),class_id TEXT REFERENCES classes(id),entry_date TEXT,horaire TEXT,content TEXT,remark TEXT,status TEXT DEFAULT 'completed',reason TEXT,session_id TEXT REFERENCES sessions(id));
CREATE TABLE IF NOT EXISTS daily_entries(id TEXT PRIMARY KEY,session_id TEXT REFERENCES sessions(id),student_id TEXT REFERENCES students(id),status TEXT,remark TEXT,UNIQUE(session_id,student_id));
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,author_id TEXT REFERENCES users(id),scope_type TEXT,scope_id TEXT,title TEXT,content TEXT,recipient_id TEXT REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS budgets(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id),label TEXT,amount REAL,spent REAL DEFAULT 0,year_label TEXT);
CREATE TABLE IF NOT EXISTS equipment(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id),name TEXT,category TEXT,quantity INTEGER,condition TEXT,notes TEXT);
CREATE TABLE IF NOT EXISTS facilities(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id),name TEXT,type TEXT,capacity TEXT,notes TEXT);
CREATE TABLE IF NOT EXISTS timetable(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id),teacher_id TEXT REFERENCES users(id),class_id TEXT REFERENCES classes(id),day_of_week TEXT,start_time TEXT,end_time TEXT,activity TEXT,facility_id TEXT);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,sender_id TEXT REFERENCES users(id),recipient_id TEXT REFERENCES users(id),subject TEXT,body TEXT,read_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY,user_id TEXT,action TEXT,entity TEXT,entity_id TEXT,details TEXT,ip TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id),created_by TEXT REFERENCES users(id),teacher_id TEXT REFERENCES users(id),status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS transfer_requests(id TEXT PRIMARY KEY,teacher_id TEXT REFERENCES users(id),from_institution_id TEXT REFERENCES institutions(id),to_institution_id TEXT REFERENCES institutions(id),requested_by TEXT,verified INTEGER DEFAULT 0,status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id),plan TEXT,starts_on TEXT,ends_on TEXT,status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),title TEXT,body TEXT,type TEXT,read_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,related_id TEXT);
CREATE TABLE IF NOT EXISTS holidays(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id),school_year TEXT,date TEXT,label TEXT NOT NULL,kind TEXT DEFAULT 'official',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS lesson_sheets(id TEXT PRIMARY KEY,teacher_id TEXT REFERENCES users(id),class_id TEXT REFERENCES classes(id),unit_id TEXT REFERENCES units(id),title TEXT,module TEXT,aps_family TEXT,aps_support TEXT,school_level TEXT,session_number TEXT,effectif INTEGER,material TEXT,terminal_objective TEXT,sequence_objective TEXT,session_objective TEXT,steps_json TEXT,schema_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS join_requests(id TEXT PRIMARY KEY,full_name TEXT NOT NULL,email TEXT,phone TEXT,requested_role TEXT,institution_name TEXT,message TEXT,status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
// V40 intelligent workflow, health safety, transfer and document audit extensions.
db.exec(`CREATE TABLE IF NOT EXISTS eps_copilot_history(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),prompt TEXT,answer TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS report_documents(id TEXT PRIMARY KEY,author_id TEXT REFERENCES users(id),institution_id TEXT REFERENCES institutions(id),document_number TEXT UNIQUE,title TEXT,category TEXT,content TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS transfer_history(id TEXT PRIMARY KEY,teacher_id TEXT REFERENCES users(id),from_institution_id TEXT,to_institution_id TEXT,approved_by TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
// V30 teacher data model extensions.
db.exec(`CREATE TABLE IF NOT EXISTS professional_years(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),school_year TEXT NOT NULL,grade TEXT,specialization TEXT,seniority TEXT,institution_name TEXT,position_note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS assessment_behavior(id TEXT PRIMARY KEY,assessment_id TEXT REFERENCES assessments(id),student_id TEXT REFERENCES students(id),base_score REAL,deduction REAL,final_score REAL,remark TEXT,UNIQUE(assessment_id,student_id));`);
// Secure one-time student self-service intake links. The raw token is never stored.
db.exec(`CREATE TABLE IF NOT EXISTS student_intake_links(id TEXT PRIMARY KEY,student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,token_hash TEXT UNIQUE NOT NULL,active INTEGER DEFAULT 1,expires_at TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,used_at TEXT);`);
// Persistent shared student portal link: one link per teacher for all of the teacher's students/classes.
db.exec(`CREATE TABLE IF NOT EXISTS student_portal_links(id TEXT PRIMARY KEY,teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT UNIQUE NOT NULL,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
const portalLinkCols=db.prepare('PRAGMA table_info(student_portal_links)').all().map(x=>x.name);
if(!portalLinkCols.includes('token_iv')) db.exec('ALTER TABLE student_portal_links ADD COLUMN token_iv TEXT');
if(!portalLinkCols.includes('token_tag')) db.exec('ALTER TABLE student_portal_links ADD COLUMN token_tag TEXT');
if(!portalLinkCols.includes('token_cipher')) db.exec('ALTER TABLE student_portal_links ADD COLUMN token_cipher TEXT');
// V36 central resource hub + evaluation model extensions.
db.exec(`CREATE TABLE IF NOT EXISTS resource_documents(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id),teacher_id TEXT REFERENCES users(id),title TEXT NOT NULL,category TEXT NOT NULL,description TEXT,school_year TEXT,file_name TEXT,mime_type TEXT,file_path TEXT,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
// V37.1 coordinator finance and asset incident tracking.
db.exec(`CREATE TABLE IF NOT EXISTS budget_transactions(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,transaction_type TEXT NOT NULL CHECK(transaction_type IN ('income','expense')),amount REAL NOT NULL DEFAULT 0,reason TEXT NOT NULL,category TEXT,transaction_date TEXT,reference TEXT,notes TEXT,created_by TEXT REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS equipment_incidents(id TEXT PRIMARY KEY,equipment_id TEXT REFERENCES equipment(id) ON DELETE SET NULL,institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,incident_type TEXT NOT NULL,quantity INTEGER DEFAULT 1,description TEXT,action_taken TEXT,incident_date TEXT,reported_by TEXT,created_by TEXT REFERENCES users(id),status TEXT DEFAULT 'open',created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS facility_incidents(id TEXT PRIMARY KEY,facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL,institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,incident_type TEXT NOT NULL,description TEXT,action_taken TEXT,incident_date TEXT,reported_by TEXT,created_by TEXT REFERENCES users(id),status TEXT DEFAULT 'open',created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
const btCols=db.prepare('PRAGMA table_info(budget_transactions)').all().map(x=>x.name); if(!btCols.includes('beneficiary')) db.exec('ALTER TABLE budget_transactions ADD COLUMN beneficiary TEXT');
// V36.1: central structured reference data used by the platform.
db.exec(`CREATE TABLE IF NOT EXISTS platform_reference_data(id TEXT PRIMARY KEY,institution_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,key TEXT NOT NULL,value_json TEXT NOT NULL,updated_by TEXT REFERENCES users(id),updated_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,key));`);
const arColsV36=db.prepare("PRAGMA table_info(assessment_results)").all().map(x=>x.name);
if(!arColsV36.includes("pro_score")) db.exec("ALTER TABLE assessment_results ADD COLUMN pro_score REAL");
if(!arColsV36.includes("con_score")) db.exec("ALTER TABLE assessment_results ADD COLUMN con_score REAL");
const deColsV36=db.prepare("PRAGMA table_info(daily_entries)").all().map(x=>x.name);
if(!deColsV36.includes("behavior_score")) db.exec("ALTER TABLE daily_entries ADD COLUMN behavior_score REAL");
if(!deColsV36.includes("behavior_note")) db.exec("ALTER TABLE daily_entries ADD COLUMN behavior_note TEXT");
fs.mkdirSync(path.join(__dirname,"assets","resources"),{recursive:true});
const studentColsV30=db.prepare('PRAGMA table_info(students)').all().map(x=>x.name);
if(!studentColsV30.includes('health_profile_json')) db.exec('ALTER TABLE students ADD COLUMN health_profile_json TEXT');
if(!studentColsV30.includes('birth_place')) db.exec('ALTER TABLE students ADD COLUMN birth_place TEXT');
if(!studentColsV30.includes('profile_json')) db.exec('ALTER TABLE students ADD COLUMN profile_json TEXT');



// V39 smart tracking + protected health file extensions.
db.exec(`CREATE TABLE IF NOT EXISTS student_health_documents(
 id TEXT PRIMARY KEY,student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 title TEXT NOT NULL,file_name TEXT,mime_type TEXT,file_path TEXT,document_type TEXT,
 notes TEXT,created_by TEXT REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);
fs.mkdirSync(path.join(__dirname,'assets','health'),{recursive:true});
// Owner finance extensions: safe for existing local databases.
// IMPORTANT: create platform_expenses BEFORE inspecting or altering its columns.
db.exec("CREATE TABLE IF NOT EXISTS platform_expenses(id TEXT PRIMARY KEY,label TEXT NOT NULL,category TEXT,amount REAL DEFAULT 0,expense_date TEXT,notes TEXT,created_by TEXT REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
const cols=db.prepare('PRAGMA table_info(subscriptions)').all().map(x=>x.name);
if(!cols.includes('amount')) db.exec('ALTER TABLE subscriptions ADD COLUMN amount REAL DEFAULT 0');
if(!cols.includes('paid_amount')) db.exec('ALTER TABLE subscriptions ADD COLUMN paid_amount REAL DEFAULT 0');
if(!cols.includes('payment_status')) db.exec("ALTER TABLE subscriptions ADD COLUMN payment_status TEXT DEFAULT 'pending'");
const joinCols=db.prepare('PRAGMA table_info(join_requests)').all().map(x=>x.name);
for(const [name,ddl] of [['institution_id','TEXT'],['subscription_id','TEXT'],['account_id','TEXT'],['payment_status','TEXT'],['paid_amount','REAL DEFAULT 0'],['subscription_end','TEXT'],['username','TEXT']]) if(!joinCols.includes(name)) db.exec(`ALTER TABLE join_requests ADD COLUMN ${name} ${ddl}`);
db.exec(`CREATE TABLE IF NOT EXISTS email_outbox(id TEXT PRIMARY KEY,request_id TEXT,recipient TEXT,subject TEXT,body TEXT,status TEXT DEFAULT 'queued',sent_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
const sessionCols=db.prepare('PRAGMA table_info(sessions)').all().map(x=>x.name);
for(const [name,ddl] of [['started_at','TEXT'],['ended_at','TEXT'],['logbook_entry_id','TEXT']]) if(!sessionCols.includes(name)) db.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${ddl}`);
const logbookCols=db.prepare('PRAGMA table_info(logbook_entries)').all().map(x=>x.name);
if(!logbookCols.includes('session_id')) db.exec('ALTER TABLE logbook_entries ADD COLUMN session_id TEXT');
const notificationCols=db.prepare('PRAGMA table_info(notifications)').all().map(x=>x.name);
if(!notificationCols.includes('related_id')) db.exec('ALTER TABLE notifications ADD COLUMN related_id TEXT');
const expenseCols=db.prepare('PRAGMA table_info(platform_expenses)').all().map(x=>x.name); if(!expenseCols.includes('reference')) db.exec('ALTER TABLE platform_expenses ADD COLUMN reference TEXT');
const messageCols=db.prepare('PRAGMA table_info(messages)').all().map(x=>x.name); if(!messageCols.includes('message_number')) db.exec('ALTER TABLE messages ADD COLUMN message_number TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_message_number ON messages(message_number) WHERE message_number IS NOT NULL');
// platform_expenses is created above before schema extensions
// Owner control-center extensions: billing documents, manual revenues, schedules and unique message numbers.
db.exec(`CREATE TABLE IF NOT EXISTS owner_revenues(id TEXT PRIMARY KEY,label TEXT NOT NULL,category TEXT,amount REAL DEFAULT 0,revenue_date TEXT,reference TEXT,notes TEXT,created_by TEXT REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS owner_pricing(id INTEGER PRIMARY KEY CHECK(id=1),institution_price REAL DEFAULT 1200,plan_name TEXT DEFAULT 'Institution Pro');
CREATE TABLE IF NOT EXISTS invoices(id TEXT PRIMARY KEY,subscription_id TEXT REFERENCES subscriptions(id),number TEXT UNIQUE NOT NULL,amount REAL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,subscription_id TEXT REFERENCES subscriptions(id),number TEXT UNIQUE NOT NULL,paid_amount REAL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS owner_report_schedules(period TEXT PRIMARY KEY,active INTEGER DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS owner_ai_reports(id TEXT PRIMARY KEY,period TEXT,title TEXT,content TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS support_alerts(id TEXT PRIMARY KEY,sender_id TEXT REFERENCES users(id),subject TEXT,body TEXT,status TEXT DEFAULT 'open',created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
// V37.15 trial system: one 7-day trial per verified contact, then the same account is upgraded by subscription.
db.exec(`CREATE TABLE IF NOT EXISTS trial_registrations(id TEXT PRIMARY KEY,email TEXT,phone TEXT,account_id TEXT REFERENCES users(id),institution_id TEXT REFERENCES institutions(id),started_on TEXT NOT NULL,ends_on TEXT NOT NULL,status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_email ON trial_registrations(lower(email)) WHERE email IS NOT NULL AND email<>''; CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_phone ON trial_registrations(phone) WHERE phone IS NOT NULL AND phone<>'';`);
const instTrialCols=db.prepare('PRAGMA table_info(institutions)').all().map(x=>x.name);
if(!instTrialCols.includes('trial_ends_on')) db.exec('ALTER TABLE institutions ADD COLUMN trial_ends_on TEXT');
if(!db.prepare('SELECT 1 FROM owner_pricing WHERE id=1').get()) db.prepare("INSERT INTO owner_pricing(id,institution_price,plan_name) VALUES(1,1200,'Institution Pro')").run();
for(const period of ['daily','weekly','monthly']) if(!db.prepare('SELECT 1 FROM owner_report_schedules WHERE period=?').get(period)) db.prepare('INSERT INTO owner_report_schedules(period,active) VALUES(?,1)').run(period);

const userColsV35=db.prepare('PRAGMA table_info(users)').all().map(x=>x.name); if(!userColsV35.includes('onboarding_complete')) db.exec('ALTER TABLE users ADD COLUMN onboarding_complete INTEGER DEFAULT 0');

// V35 schema extensions: coordinator-controlled annual planning and unit scheduling.
try{db.exec("ALTER TABLE units ADD COLUMN cycle INTEGER DEFAULT 1");}catch{}
try{db.exec("ALTER TABLE units ADD COLUMN start_date TEXT");}catch{}
try{db.exec("ALTER TABLE units ADD COLUMN end_date TEXT");}catch{}
const id=()=>crypto.randomUUID();
const PORTAL_SECRET=crypto.createHash('sha256').update(String(process.env.EPS_PORTAL_SECRET||'EPS-PILOT-student-portal-local-secret')).digest();
function protectPortalToken(raw){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',PORTAL_SECRET,iv);const enc=Buffer.concat([c.update(raw,'utf8'),c.final()]);return {iv:iv.toString('base64url'),tag:c.getAuthTag().toString('base64url'),cipher:enc.toString('base64url')}}
function revealPortalToken(row){if(!row?.token_cipher||!row?.token_iv||!row?.token_tag)return null;try{const d=crypto.createDecipheriv('aes-256-gcm',PORTAL_SECRET,Buffer.from(row.token_iv,'base64url'));d.setAuthTag(Buffer.from(row.token_tag,'base64url'));return Buffer.concat([d.update(Buffer.from(row.token_cipher,'base64url')),d.final()]).toString('utf8')}catch{return null}}
function parseXlsxWithPython(buffer){
 // Native XLSX reader: no Python/Excel installation is required on the teacher's computer.
 const files={};
 const eocdSig=0x06054b50; let eocd=-1;
 for(let i=buffer.length-22;i>=Math.max(0,buffer.length-22-0xFFFF);i--){if(i>=0&&buffer.readUInt32LE(i)===eocdSig){eocd=i;break;}}
 if(eocd<0)throw new Error('ملف Excel غير صالح أو غير مكتمل.');
 const cdSize=buffer.readUInt32LE(eocd+12),cdOffset=buffer.readUInt32LE(eocd+16);
 let off=cdOffset,endCd=cdOffset+cdSize;
 while(off+46<=endCd && buffer.readUInt32LE(off)===0x02014b50){
   const flags=buffer.readUInt16LE(off+8),method=buffer.readUInt16LE(off+10),csize=buffer.readUInt32LE(off+20),usize=buffer.readUInt32LE(off+24);
   const nlen=buffer.readUInt16LE(off+28),elen=buffer.readUInt16LE(off+30),clen=buffer.readUInt16LE(off+32),lho=buffer.readUInt32LE(off+42);
   const name=buffer.slice(off+46,off+46+nlen).toString('utf8');
   if(flags&1) throw new Error('ملف Excel محمي بكلمة مرور ولا يمكن استيراده.');
   if(lho+30>buffer.length) throw new Error('بنية ملف Excel غير صالحة.');
   const ln=buffer.readUInt16LE(lho+26),le=buffer.readUInt16LE(lho+28),dataStart=lho+30+ln+le,dataEnd=dataStart+csize;
   if(dataEnd>buffer.length) throw new Error('ملف Excel غير مكتمل.');
   let data=buffer.slice(dataStart,dataEnd);
   if(method===8)data=inflateRawSync(data); else if(method!==0)throw new Error('طريقة ضغط Excel غير مدعومة.');
   if(usize && data.length!==usize) { /* tolerate Excel producers that omit/alter this field */ }
   files[name]=data;
   off+=46+nlen+elen+clen;
 }
 const xml=(name)=>files[name]?files[name].toString('utf8'):null;
 const decodeXml=x=>String(x??'').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
 const shared=[]; const sh=xml('xl/sharedStrings.xml');
 if(sh){for(const m of sh.matchAll(/<si\b[\s\S]*?<\/si>/g)){shared.push([...m[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>decodeXml(x[1])).join(''));}}
 const wb=xml('xl/workbook.xml');
 const rels=xml('xl/_rels/workbook.xml.rels')||'';
 const relMap={}; for(const m of rels.matchAll(/<Relationship\b([^>]*?)\/>/g)){const a=m[1],id=(a.match(/\bId="([^"]+)"/)||[])[1],target=(a.match(/\bTarget="([^"]+)"/)||[])[1];if(id&&target)relMap[id]=target.replace(/^\//,'').startsWith('xl/')?target.replace(/^\//,''):'xl/'+target.replace(/^\//,'').replace(/^\.\//,'');}
 const sheets=[];
 if(wb){for(const m of wb.matchAll(/<sheet\b([^>]*?)\/>/g)){const a=m[1],name=(a.match(/\bname="([^"]*)"/)||[])[1],rid=(a.match(/\br:id="([^"]+)"/)||[])[1];if(name&&rid&&relMap[rid])sheets.push({name:decodeXml(name),path:relMap[rid]});}}
 if(!sheets.length){const path=Object.keys(files).find(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n));if(path)sheets.push({name:'Sheet1',path});}
 if(!sheets.length)throw new Error('لم يتم العثور على ورقة Excel.');
 const parseSheet=(sheetPath)=>{const x=xml(sheetPath);if(!x)throw new Error('تعذر فتح ورقة Excel.');const out=[];
   for(const rm of x.matchAll(/<row\b[\s\S]*?<\/row>/g)){const cells={};
     for(const cm of rm[0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){const attrs=cm[1],body=cm[2],rr=(attrs.match(/\br="([A-Z]+)\d+"/)||[])[1];if(!rr)continue;let col=0;for(const ch of rr)col=col*26+ch.charCodeAt(0)-64;col--;const typ=(attrs.match(/\bt="([^"]+)"/)||[])[1];const vm=body.match(/<v>([\s\S]*?)<\/v>/);let text='';
       if(typ==='inlineStr')text=[...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>decodeXml(x[1])).join('');
       else if(typ==='s'&&vm){const idx=Number(vm[1]);text=shared[idx]??'';}
       else if(vm)text=decodeXml(vm[1]);
       else {const fm=body.match(/<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/);if(fm)text=decodeXml(fm[1]);}
       cells[col]=text;
     }
     const max=Object.keys(cells).length?Math.max(...Object.keys(cells).map(Number)):-1;if(max>=0)out.push(Array.from({length:max+1},(_,i)=>cells[i]??''));
   } return out;};
 return {sheets:sheets.map(s=>({name:s.name,rows:parseSheet(s.path)})),rows:parseSheet(sheets[0].path)};
}
function parseCsvBuffer(buffer){const text=buffer.toString('utf8').replace(/^\ufeff/,'');return text.split(/\r?\n/).filter(Boolean).map(line=>line.split(/\t|;|,/).map(x=>x.trim()));}
function normalizeStudentRows(rows){
 const clean=v=>String(v??'').replace(/\u00a0/g,' ').replace(/[\r\n]+/g,' ').trim();
 const key=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_\-./:()\\]+/g,'');
 const aliases={
   ordinal:['ر.ت','رت','الرقم الترتيبي','الرقم','no','n°','numero','ordinal'],
   massar:['الرمز','رمز','رقم مسار','مسار','massar','massar number','massar_number','numero massar','code massar','code'],
   last:['النسب','اللقب','nom','surname','last name','lastname'],
   first:['الاسم','الاسم الشخصي','prénom','prenom','first name','firstname','given name'],
   full:['الاسم الكامل','nom complet','full name','fullname'],
   gender:['النوع','الجنس','genre','gender','sexe'],
   dob:['تاريخ الازدياد','تاريخ الميلاد','date de naissance','date naissance','dob','birth date'],
   birth:['مكان الازدياد','مكان الميلاد','lieu de naissance','birth place','birthplace']
 };
 const matches=(cell, aliasesList)=>{const k=key(cell);if(!k)return false;return aliasesList.some(a=>{const ak=key(a);return !!ak&&(k===ak||k.includes(ak)||ak.includes(k))})};
 let headerIndex=-1,bestScore=0;
 for(let ri=0;ri<Math.min(Array.isArray(rows)?rows.length:0,60);ri++){
   const r=Array.isArray(rows[ri])?rows[ri]:[]; let score=0;
   for(const vals of Object.values(aliases)) if(r.some(cell=>matches(cell,vals))) score++;
   // The real roster header normally contains Massar/code + surname/name.
   if(score>=2 && score>bestScore){bestScore=score;headerIndex=ri;}
 }
 const header=headerIndex>=0&&Array.isArray(rows?.[headerIndex])?rows[headerIndex]:[];
 const findIdx=(names,def)=>{for(let i=0;i<header.length;i++)if(matches(header[i],names))return i;return def};
 const oi=findIdx(aliases.ordinal,0), mi=findIdx(aliases.massar,1), li=findIdx(aliases.last,2), fi=findIdx(aliases.first,3), ni=findIdx(aliases.full,-1), gi=findIdx(aliases.gender,4), di=findIdx(aliases.dob,5), bi=findIdx(aliases.birth,6);
 const excelDate=v=>{const x=clean(v);if(!x)return '';if(/^\d+(?:\.\d+)?$/.test(x)){const n=Number(x);if(n>20000&&n<60000){const d=new Date(Date.UTC(1899,11,30)+n*86400000);return d.toISOString().slice(0,10)}}return x};
 const normalizeGender=v=>{const x=clean(v).toLowerCase();if(!x)return '';if(['f','female','féminin','feminin','أنثى','بنت'].includes(x))return 'F';if(['m','male','masculin','ذكر','ولد'].includes(x))return 'M';return x};
 const source=(headerIndex>=0?rows.slice(headerIndex+1):Array.isArray(rows)?rows:[]);
 const looksLikeMetadata=v=>{const x=key(v);return ['الاكاديمية','المديريةالاقليمية','المديرية','المستوى','القسم','الرمز','النسب','الاسم','رت','رت'].includes(x)||x.startsWith('الاكاديمية')||x.startsWith('المديرية')||x.startsWith('المستوى')||x.startsWith('القسم')};
 return source.map(r=>{
   if(!Array.isArray(r)) return null;
   const massar=clean(r[mi]);
   let last=clean(r[li]), first=clean(r[fi]);
   if(ni>=0){const full=clean(r[ni]);if(!last && full){const a=full.split(/\s+/).filter(Boolean);last=a.shift()||'';first=first||a.join(' ')}}
   const ordinal=oi>=0?clean(r[oi]):'';
   const dob=di>=0?excelDate(r[di]):'';
   const gender=gi>=0?normalizeGender(r[gi]):'';
   const birth=bi>=0?clean(r[bi]):'';
   // Never treat school metadata or the header itself as a student.
   if(!massar || looksLikeMetadata(massar) || /^(massar|massar_number|رقم مسار|مسار|الرمز|code)$/i.test(massar)) return null;
   // A Massar/code field should look like an identifier; otherwise require a real first/last name.
   const identifier=/^[A-Za-z0-9][A-Za-z0-9._\-/]{3,}$/.test(massar) || /^P\d{6,}$/i.test(massar) || /^\d{6,}$/.test(massar);
   if(!identifier && (!first && !last)) return null;
   if(!first && !last) return null;
   return {massar_number:massar,first_name:first,last_name:last,dob,gender,birth_place:birth,ordinal};
 }).filter(Boolean);
}
const locale=req=>{const x=(req.headers['x-language']||'ar').toLowerCase();return ['ar','fr','en'].includes(x)?x:'ar'};
const tr=(l,ar,fr,en)=>l==='fr'?fr:l==='en'?en:ar;

const hash=p=>{const salt=crypto.randomBytes(16).toString('hex'); return salt+':'+crypto.scryptSync(p,salt,64).toString('hex')};
const verify=(p,h)=>{try{const [salt,key]=h.split(':'); return crypto.timingSafeEqual(crypto.scryptSync(p,salt,64),Buffer.from(key,'hex'))}catch{return false}};
const seed=()=>{
 const n=db.prepare('SELECT COUNT(*) c FROM users').get().c; if(n) return;
 const owner=id();
 db.prepare('INSERT INTO users(id,username,password_hash,role,full_name,email,institution_id,force_password_change) VALUES(?,?,?,?,?,?,?,?)').run(owner,'owner',hash('EPS-PILOT-OWNER'),'owner','مالك المنصة','',null,0);
}; seed();
const sessions=new Map();
const rateBuckets=new Map();
function rateLimit(req,key,limit=60,windowMs=60000){const now=Date.now(),k=key+'|'+(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown'),b=rateBuckets.get(k);if(!b||now-b.start>=windowMs){rateBuckets.set(k,{start:now,count:1});return true}b.count++;return b.count<=limit}

function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}))}
function auth(req){const s=sessions.get(parseCookies(req).eps_session); if(!s) return null; const x=db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(s.userId); if(!x)return null; if(x.institution_id){const inst=db.prepare('SELECT subscription_status,trial_ends_on FROM institutions WHERE id=?').get(x.institution_id); if(inst){const today=new Date().toISOString().slice(0,10); const activeSub=db.prepare("SELECT 1 FROM subscriptions WHERE institution_id=? AND status='active' AND (ends_on IS NULL OR ends_on>=?) LIMIT 1").get(x.institution_id,today); x.subscription_state=activeSub?'active':(inst.subscription_status==='trial'&&inst.trial_ends_on&&inst.trial_ends_on>=today?'trial':(inst.subscription_status==='expired'||inst.subscription_status==='trial_expired'?'expired':'unpaid')); x.billing_only=x.subscription_state==='expired'||x.subscription_state==='unpaid'; }} return x}
function institutionScope(u){if(!u)return []; if(u.role==='owner') return db.prepare('SELECT * FROM institutions').all(); if(u.role==='coordinator'||u.role==='teacher') return u.institution_id?[db.prepare('SELECT * FROM institutions WHERE id=?').get(u.institution_id)]:[]; if(u.role==='inspector') return db.prepare('SELECT i.* FROM institutions i JOIN inspector_institutions x ON x.institution_id=i.id WHERE x.inspector_id=? AND x.status=\'active\'').all(u.id); return []}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(),microphone=(),geolocation=()'});res.end(JSON.stringify(data))}
async function body(req){return await new Promise((resolve,reject)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}})})}
function audit(u,action,entity,entityId,details,ip){db.prepare('INSERT INTO audit_log(id,user_id,action,entity,entity_id,details,ip,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id(),u?.id||null,action,entity,entityId,JSON.stringify(details||{}),ip||'127.0.0.1',new Date().toISOString())}
function deny(res,msg='غير مسموح'){return json(res,403,{error:msg})}
function sameInst(u,inst){return u.role==='owner'||(u.institution_id===inst)}
function accessibleClass(u,c){if(!c)return false; if(u.role==='owner')return true; if(u.role==='inspector')return institutionScope(u).some(i=>i.id===c.institution_id); return c.institution_id===u.institution_id && (u.role==='coordinator'||c.teacher_id===u.id)}
function accessibleTeacher(u,t){if(!t)return false;if(u.role==='owner')return true;if(u.role==='inspector')return institutionScope(u).some(i=>i.id===t.institution_id);if(u.role==='coordinator')return t.institution_id===u.institution_id;return t.id===u.id}


setInterval(()=>{try{for(const t of db.prepare("SELECT id FROM users WHERE role='teacher' AND active=1").all())syncTeacherSessions(t.id)}catch{}},30000);
function makeInvoice(subscriptionId,amount){const n='INV-'+new Date().getFullYear()+'-'+crypto.randomBytes(5).toString('hex').toUpperCase();const iid=id();db.prepare('INSERT INTO invoices(id,subscription_id,number,amount) VALUES(?,?,?,?)').run(iid,subscriptionId,n,Number(amount||0));return {id:iid,number:n,amount:Number(amount||0)}}
function makeReceipt(subscriptionId,paid){const n='BON-'+new Date().getFullYear()+'-'+crypto.randomBytes(5).toString('hex').toUpperCase();const rid=id();db.prepare('INSERT INTO receipts(id,subscription_id,number,paid_amount) VALUES(?,?,?,?)').run(rid,subscriptionId,n,Number(paid||0));return {id:rid,number:n,paid_amount:Number(paid||0)}}
function ensureInvoice(sid,amount){return db.prepare('SELECT * FROM invoices WHERE subscription_id=? ORDER BY created_at DESC LIMIT 1').get(sid)||makeInvoice(sid,amount)}
function ensureReceipt(sid,paid){return db.prepare('SELECT * FROM receipts WHERE subscription_id=? ORDER BY created_at DESC LIMIT 1').get(sid)||makeReceipt(sid,paid)}
function enforceSubscriptionExpiry(){
  try{
    const today=new Date().toISOString().slice(0,10);
    // Mark subscriptions past their end date as expired (keep history intact).
    db.prepare("UPDATE subscriptions SET status='expired' WHERE status='active' AND ends_on IS NOT NULL AND ends_on<?").run(today);
    db.prepare("UPDATE subscriptions SET status='expired',payment_status='pending' WHERE status='trial' AND ends_on IS NOT NULL AND ends_on<?").run(today);
    db.prepare("UPDATE institutions SET subscription_status='trial_expired' WHERE subscription_status='trial' AND trial_ends_on IS NOT NULL AND trial_ends_on<?").run(today);
    // Any institution with zero remaining active subscription -> auto-suspend institution + its non-owner accounts.
    const toSuspend=db.prepare(`SELECT i.id FROM institutions i WHERE i.subscription_status='active' AND NOT EXISTS(SELECT 1 FROM subscriptions s WHERE s.institution_id=i.id AND s.status='active' AND (s.ends_on IS NULL OR s.ends_on>=?))`).all(today);
    for(const inst of toSuspend){
      db.prepare("UPDATE institutions SET subscription_status='expired' WHERE id=?").run(inst.id);
      db.prepare("UPDATE users SET active=0 WHERE institution_id=? AND role!='owner'").run(inst.id);
      audit(null,'AUTO_SUSPEND','institution',inst.id,{reason:'subscription_expired'});
      const admins=db.prepare("SELECT id FROM users WHERE role='owner' AND active=1").all();
      for(const a of admins)db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),a.id,'تعطيل تلقائي لانتهاء الاشتراك','تم تعطيل مؤسسة تلقائياً بسبب انتهاء صلاحية الاشتراك دون تجديد.','subscription',null,new Date().toISOString(),inst.id);
    }
    // Re-activate institutions that got a fresh/renewed subscription after being auto-expired.
    const toReactivate=db.prepare(`SELECT i.id FROM institutions i WHERE i.subscription_status='expired' AND EXISTS(SELECT 1 FROM subscriptions s WHERE s.institution_id=i.id AND s.status='active' AND (s.ends_on IS NULL OR s.ends_on>=?))`).all(today);
    for(const inst of toReactivate){
      db.prepare("UPDATE institutions SET subscription_status='active' WHERE id=?").run(inst.id);
      db.prepare("UPDATE users SET active=1 WHERE institution_id=? AND role!='owner'").run(inst.id);
      audit(null,'AUTO_REACTIVATE','institution',inst.id,{reason:'subscription_renewed'});
    }
  }catch(e){console.error('subscription expiry check failed',e.message)}
}
function hardDeleteUserAccount(uid){
  const x=db.prepare('SELECT * FROM users WHERE id=?').get(uid);
  if(!x) throw new Error('الحساب غير موجود');
  if(x.role==='owner') throw new Error('لا يمكن حذف مالك المنصة');
  db.exec('BEGIN');
  try{
    // Break all user relationships first so foreign-key enforcement cannot block deletion.
    db.prepare('DELETE FROM inspector_institutions WHERE inspector_id=?').run(uid);
    db.prepare('UPDATE classes SET teacher_id=NULL WHERE teacher_id=?').run(uid);
    db.prepare('DELETE FROM timetable WHERE teacher_id=?').run(uid);
    db.prepare('DELETE FROM daily_entries WHERE session_id IN (SELECT id FROM sessions WHERE teacher_id=?)').run(uid);
    db.prepare('DELETE FROM assessment_behavior WHERE assessment_id IN (SELECT id FROM assessments WHERE teacher_id=?)').run(uid);
    db.prepare('DELETE FROM assessment_results WHERE assessment_id IN (SELECT id FROM assessments WHERE teacher_id=?)').run(uid);
    db.prepare('DELETE FROM logbook_entries WHERE teacher_id=?').run(uid);
    db.prepare('DELETE FROM lesson_sheets WHERE teacher_id=?').run(uid);
    db.prepare('DELETE FROM assessments WHERE teacher_id=?').run(uid);
    db.prepare('DELETE FROM sessions WHERE teacher_id=?').run(uid);
    db.prepare('DELETE FROM units WHERE plan_id IN (SELECT id FROM annual_plans WHERE teacher_id=?)').run(uid);
    db.prepare('DELETE FROM annual_plans WHERE teacher_id=?').run(uid);
    db.prepare('DELETE FROM student_portal_links WHERE teacher_id=?').run(uid);
    db.prepare('DELETE FROM professional_access_requests WHERE teacher_id=? OR inspector_id=?').run(uid,uid);
    db.prepare('DELETE FROM invites WHERE teacher_id=? OR created_by=?').run(uid,uid);
    db.prepare('DELETE FROM transfer_requests WHERE teacher_id=? OR requested_by=?').run(uid,uid);
    db.prepare('DELETE FROM teacher_profiles WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM professional_documents WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM professional_years WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM resource_documents WHERE teacher_id=?').run(uid);
    db.prepare('DELETE FROM reports WHERE author_id=? OR recipient_id=?').run(uid,uid);
    db.prepare('DELETE FROM messages WHERE sender_id=? OR recipient_id=?').run(uid,uid);
    db.prepare('DELETE FROM notifications WHERE user_id=?').run(uid);
    db.prepare('DELETE FROM support_alerts WHERE sender_id=?').run(uid);
    db.prepare('UPDATE budget_transactions SET created_by=NULL WHERE created_by=?').run(uid);
    db.prepare('UPDATE equipment_incidents SET created_by=NULL WHERE created_by=?').run(uid);
    db.prepare('UPDATE facility_incidents SET created_by=NULL WHERE created_by=?').run(uid);
    db.prepare('UPDATE platform_expenses SET created_by=NULL WHERE created_by=?').run(uid);
    db.prepare('UPDATE owner_revenues SET created_by=NULL WHERE created_by=?').run(uid);
    db.prepare('UPDATE platform_reference_data SET updated_by=NULL WHERE updated_by=?').run(uid);
    db.prepare('UPDATE trial_registrations SET account_id=NULL WHERE account_id=?').run(uid);
    db.prepare('DELETE FROM users WHERE id=?').run(uid);
    db.exec('COMMIT');
  }catch(err){ try{db.exec('ROLLBACK')}catch{}; throw err; }
}

function hardDeleteInstitution(iid){
  const inst=db.prepare('SELECT id FROM institutions WHERE id=?').get(iid);
  if(!inst) throw new Error('المؤسسة غير موجودة');
  const userIds=db.prepare("SELECT id FROM users WHERE institution_id=? AND role!='owner'").all(iid).map(x=>x.id);
  const subIds=db.prepare('SELECT id FROM subscriptions WHERE institution_id=?').all(iid).map(x=>x.id);
  db.exec('BEGIN');
  try{
    // Delete institution-owned educational data first.
    db.prepare('DELETE FROM assessment_behavior WHERE assessment_id IN (SELECT id FROM assessments WHERE class_id IN (SELECT id FROM classes WHERE institution_id=?))').run(iid);
    db.prepare('DELETE FROM assessment_results WHERE assessment_id IN (SELECT id FROM assessments WHERE class_id IN (SELECT id FROM classes WHERE institution_id=?))').run(iid);
    db.prepare('DELETE FROM attendance WHERE session_id IN (SELECT id FROM sessions WHERE class_id IN (SELECT id FROM classes WHERE institution_id=?))').run(iid);
    db.prepare('DELETE FROM daily_entries WHERE session_id IN (SELECT id FROM sessions WHERE class_id IN (SELECT id FROM classes WHERE institution_id=?))').run(iid);
    db.prepare('DELETE FROM logbook_entries WHERE class_id IN (SELECT id FROM classes WHERE institution_id=?)').run(iid);
    db.prepare('DELETE FROM lesson_sheets WHERE class_id IN (SELECT id FROM classes WHERE institution_id=?)').run(iid);
    db.prepare('DELETE FROM assessments WHERE class_id IN (SELECT id FROM classes WHERE institution_id=?)').run(iid);
    db.prepare('DELETE FROM sessions WHERE class_id IN (SELECT id FROM classes WHERE institution_id=?)').run(iid);
    db.prepare('DELETE FROM units WHERE class_id IN (SELECT id FROM classes WHERE institution_id=?) OR plan_id IN (SELECT id FROM annual_plans WHERE institution_id=?)').run(iid,iid);
    db.prepare('DELETE FROM annual_plans WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM timetable WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM students WHERE class_id IN (SELECT id FROM classes WHERE institution_id=?)').run(iid);
    db.prepare('DELETE FROM classes WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM equipment_incidents WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM facility_incidents WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM budget_transactions WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM budgets WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM equipment WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM facilities WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM holidays WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM resource_documents WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM platform_reference_data WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM inspector_institutions WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM invites WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM transfer_requests WHERE from_institution_id=? OR to_institution_id=?').run(iid,iid);
    db.prepare('DELETE FROM trial_registrations WHERE institution_id=?').run(iid);
    if(subIds.length){ const ph=subIds.map(()=>'?').join(','); db.prepare(`DELETE FROM invoices WHERE subscription_id IN (${ph})`).run(...subIds); db.prepare(`DELETE FROM receipts WHERE subscription_id IN (${ph})`).run(...subIds); }
    db.prepare('DELETE FROM subscriptions WHERE institution_id=?').run(iid);
    db.prepare('DELETE FROM reports WHERE scope_id=?').run(iid);

    // Remove all accounts that belong to this institution. Owner is never touched.
    for(const uid of userIds){
      db.prepare('DELETE FROM inspector_institutions WHERE inspector_id=?').run(uid);
      db.prepare('UPDATE classes SET teacher_id=NULL WHERE teacher_id=?').run(uid);
      db.prepare('DELETE FROM timetable WHERE teacher_id=?').run(uid);
      db.prepare('DELETE FROM daily_entries WHERE session_id IN (SELECT id FROM sessions WHERE teacher_id=?)').run(uid);
      db.prepare('DELETE FROM assessment_behavior WHERE assessment_id IN (SELECT id FROM assessments WHERE teacher_id=?)').run(uid);
      db.prepare('DELETE FROM assessment_results WHERE assessment_id IN (SELECT id FROM assessments WHERE teacher_id=?)').run(uid);
      db.prepare('DELETE FROM logbook_entries WHERE teacher_id=?').run(uid);
      db.prepare('DELETE FROM lesson_sheets WHERE teacher_id=?').run(uid);
      db.prepare('DELETE FROM assessments WHERE teacher_id=?').run(uid);
      db.prepare('DELETE FROM sessions WHERE teacher_id=?').run(uid);
      db.prepare('DELETE FROM units WHERE plan_id IN (SELECT id FROM annual_plans WHERE teacher_id=?)').run(uid);
      db.prepare('DELETE FROM annual_plans WHERE teacher_id=?').run(uid);
      db.prepare('DELETE FROM student_portal_links WHERE teacher_id=?').run(uid);
      db.prepare('DELETE FROM professional_access_requests WHERE teacher_id=? OR inspector_id=?').run(uid,uid);
      db.prepare('DELETE FROM invites WHERE teacher_id=? OR created_by=?').run(uid,uid);
      db.prepare('DELETE FROM transfer_requests WHERE teacher_id=? OR requested_by=?').run(uid,uid);
      db.prepare('DELETE FROM teacher_profiles WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM professional_documents WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM professional_years WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM resource_documents WHERE teacher_id=?').run(uid);
      db.prepare('DELETE FROM reports WHERE author_id=? OR recipient_id=?').run(uid,uid);
      db.prepare('DELETE FROM messages WHERE sender_id=? OR recipient_id=?').run(uid,uid);
      db.prepare('DELETE FROM notifications WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM support_alerts WHERE sender_id=?').run(uid);
      db.prepare('UPDATE budget_transactions SET created_by=NULL WHERE created_by=?').run(uid);
      db.prepare('UPDATE equipment_incidents SET created_by=NULL WHERE created_by=?').run(uid);
      db.prepare('UPDATE facility_incidents SET created_by=NULL WHERE created_by=?').run(uid);
      db.prepare('UPDATE platform_expenses SET created_by=NULL WHERE created_by=?').run(uid);
      db.prepare('UPDATE owner_revenues SET created_by=NULL WHERE created_by=?').run(uid);
      db.prepare('UPDATE platform_reference_data SET updated_by=NULL WHERE updated_by=?').run(uid);
      db.prepare('UPDATE trial_registrations SET account_id=NULL WHERE account_id=?').run(uid);
      db.prepare('DELETE FROM audit_log WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM users WHERE id=?').run(uid);
    }
    db.prepare('DELETE FROM audit_log WHERE entity_id=?').run(iid);
    db.prepare('DELETE FROM institutions WHERE id=?').run(iid);
    db.exec('COMMIT');
  }catch(err){ try{db.exec('ROLLBACK')}catch{}; throw err; }
}

function ownerOverviewData(){const institutions=db.prepare("SELECT COUNT(*) c FROM institutions WHERE subscription_status!='deleted'").get().c,teachers=db.prepare("SELECT COUNT(*) c FROM users WHERE role='teacher' AND active=1").get().c,coordinators=db.prepare("SELECT COUNT(*) c FROM users WHERE role='coordinator' AND active=1").get().c,inspectors=db.prepare("SELECT COUNT(*) c FROM users WHERE role='inspector' AND active=1").get().c,subs=db.prepare("SELECT COUNT(*) c FROM subscriptions s JOIN institutions i ON i.id=s.institution_id WHERE i.subscription_status!='deleted' AND s.status='active'").get().c,revenue=Number(db.prepare('SELECT COALESCE(SUM(paid_amount),0) x FROM subscriptions').get().x||0)+Number(db.prepare('SELECT COALESCE(SUM(amount),0) x FROM owner_revenues').get().x||0),expenses=Number(db.prepare('SELECT COALESCE(SUM(amount),0) x FROM platform_expenses').get().x||0);return {institutions,teachers,coordinators,inspectors,subscriptions:subs,revenue:Number(revenue),expenses:Number(expenses),net:Number(revenue)-Number(expenses)}}
function aiOwnerSummary(period,d){const label=period==='daily'?'اليومي':period==='weekly'?'الأسبوعي':'الشهري';return `تحليل ${label}: المنصة تضم ${d.institutions} مؤسسة، ${d.teachers} أستاذاً، ${d.coordinators} منسقين و${d.inspectors} مفتشين نشطين. قيمة المداخيل المسجلة ${d.revenue.toFixed(2)} درهم مقابل ${d.expenses.toFixed(2)} درهم مصاريف، والصافي ${d.net.toFixed(2)} درهم. المؤشر المالي الحالي ${d.net>=0?'إيجابي':'يحتاج متابعة'}، ويُنصح بمراجعة الاشتراكات غير المؤداة والمصاريف الأعلى دورياً. هذا ملخص تحليلي مساعد ولا يتخذ قرارات مالية نهائية.`}

async function sendAccountEmail(to,subject,bodyText,requestId){
 if(!to) return {status:'no_email'};
 const rowId=id();
 db.prepare('INSERT INTO email_outbox(id,request_id,recipient,subject,body,status) VALUES(?,?,?,?,?,?)').run(rowId,requestId,to,subject,bodyText,'queued');
 // Optional production delivery hook. Local mode remains queued until a mail provider is configured.
 const hook=process.env.EMAIL_WEBHOOK_URL;
 if(hook){try{const r=await fetch(hook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,subject,text:bodyText})});if(r.ok){db.prepare('UPDATE email_outbox SET status=?,sent_at=? WHERE id=?').run('sent',new Date().toISOString(),rowId);return {status:'sent'}}}catch{} }
 return {status:'queued'};
}
function createPaidAccountFromRequest(reqRow,owner){
 const requestedRole=['teacher','coordinator','inspector'].includes(reqRow.requested_role)?reqRow.requested_role:'coordinator';
 let inst=null;
 if(reqRow.institution_id) inst=db.prepare('SELECT * FROM institutions WHERE id=?').get(reqRow.institution_id);
 if(!inst && reqRow.institution_name) inst=db.prepare('SELECT * FROM institutions WHERE lower(name)=lower(?)').get(reqRow.institution_name.trim());
 if(!inst){const iid=id(),code='EPS'+crypto.randomBytes(3).toString('hex').toUpperCase();db.prepare('INSERT INTO institutions(id,name,code,subscription_status) VALUES(?,?,?,?)').run(iid,reqRow.institution_name||('مؤسسة '+reqRow.full_name),code,'active');inst=db.prepare('SELECT * FROM institutions WHERE id=?').get(iid);}
 const existingSub=db.prepare("SELECT * FROM subscriptions WHERE institution_id=? AND status='active' ORDER BY created_at DESC LIMIT 1").get(inst.id);
 const price=Number(db.prepare('SELECT institution_price FROM owner_pricing WHERE id=1').get().institution_price||1200);
 const starts=new Date().toISOString().slice(0,10),ends=new Date(Date.now()+365*86400000).toISOString().slice(0,10);
 const sub=existingSub||(()=>{const sid=id();db.prepare("INSERT INTO subscriptions(id,institution_id,plan,starts_on,ends_on,status,created_at,amount,paid_amount,payment_status) VALUES(?,?,?,?,?,?,?,?,?,?)").run(sid,inst.id,db.prepare('SELECT plan_name FROM owner_pricing WHERE id=1').get().plan_name,starts,ends,'active',new Date().toISOString(),price,price,'paid');return db.prepare('SELECT * FROM subscriptions WHERE id=?').get(sid)})();
 if(existingSub){db.prepare("UPDATE subscriptions SET status='active',payment_status='paid',amount=?,paid_amount=?,starts_on=?,ends_on=? WHERE id=?").run(existingSub.amount||price,price,existingSub.starts_on||starts,existingSub.ends_on||ends,existingSub.id)}
 let account=db.prepare('SELECT * FROM users WHERE id=?').get(reqRow.account_id||'');
 if(!account) account=db.prepare('SELECT * FROM users WHERE email=? AND institution_id=? AND role=? ORDER BY created_at DESC LIMIT 1').get(reqRow.email||'',inst.id,requestedRole);
 let temp=crypto.randomBytes(8).toString('base64url');
 if(!account){const base=(requestedRole==='teacher'?'teacher_':requestedRole==='inspector'?'insp_':'coord_')+inst.code.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10);let username=base,n=1;while(db.prepare('SELECT 1 FROM users WHERE username=?').get(username))username=base+(n++);const uid=id();db.prepare('INSERT INTO users(id,username,password_hash,role,full_name,email,phone,institution_id,active,force_password_change,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(uid,username,hash(temp),requestedRole,reqRow.full_name,reqRow.email||null,reqRow.phone||null,inst.id,1,1,new Date().toISOString());account=db.prepare('SELECT * FROM users WHERE id=?').get(uid);}else{temp=crypto.randomBytes(8).toString('base64url');db.prepare('UPDATE users SET password_hash=?,active=1,force_password_change=1 WHERE id=?').run(hash(temp),account.id)}
 db.prepare('UPDATE institutions SET subscription_status=? WHERE id=?').run('active',inst.id);
 db.prepare('UPDATE join_requests SET status=?,payment_status=?,institution_id=?,subscription_id=?,account_id=?,paid_amount=?,subscription_end=?,username=? WHERE id=?').run('account_created','paid',inst.id,sub.id,account.id,price,sub.ends_on,account.username,reqRow.id);
 const invoice=ensureInvoice(sub.id,sub.amount),receipt=ensureReceipt(sub.id,price);
 return {id:account.id,username:account.username,temp_password:temp,full_name:account.full_name,email:account.email,institution_name:inst.name,subscription:{id:sub.id,amount:sub.amount,paid_amount:price,ends_on:sub.ends_on,invoice:invoice.number,receipt:receipt.number},request_id:reqRow.id};
}


function seedTeacherHolidays(instId){
 const schoolYear='2026-2027';
 const count=db.prepare('SELECT COUNT(*) c FROM holidays WHERE institution_id=? AND school_year=?').get(instId,schoolYear).c;
 if(count) return;
 const fixed=[
  ['2026-10-18','العطلة البينية الأولى / Vacances intercalaires 1','official'],['2026-10-19','العطلة البينية الأولى / Vacances intercalaires 1','official'],['2026-10-20','العطلة البينية الأولى / Vacances intercalaires 1','official'],['2026-10-21','العطلة البينية الأولى / Vacances intercalaires 1','official'],['2026-10-22','العطلة البينية الأولى / Vacances intercalaires 1','official'],['2026-10-23','العطلة البينية الأولى / Vacances intercalaires 1','official'],['2026-10-24','العطلة البينية الأولى / Vacances intercalaires 1','official'],['2026-10-25','العطلة البينية الأولى / Vacances intercalaires 1','official'],
  ['2026-10-31','عيد الوحدة / Fête de l’Unité','official'],['2026-11-06','ذكرى المسيرة الخضراء / Anniversaire de la Marche Verte','official'],['2026-11-18','عيد الاستقلال / Fête de l’Indépendance','official'],
  ['2026-12-06','العطلة البينية الثانية / Vacances intercalaires 2','official'],['2026-12-07','العطلة البينية الثانية / Vacances intercalaires 2','official'],['2026-12-08','العطلة البينية الثانية / Vacances intercalaires 2','official'],['2026-12-09','العطلة البينية الثانية / Vacances intercalaires 2','official'],['2026-12-10','العطلة البينية الثانية / Vacances intercalaires 2','official'],['2026-12-11','العطلة البينية الثانية / Vacances intercalaires 2','official'],['2026-12-12','العطلة البينية الثانية / Vacances intercalaires 2','official'],['2026-12-13','العطلة البينية الثانية / Vacances intercalaires 2','official'],
  ['2027-01-01','فاتح السنة الميلادية / Nouvel An grégorien','official'],['2027-01-11','ذكرى تقديم وثيقة الاستقلال / Manifeste de l’Indépendance','official'],['2027-01-14','فاتح السنة الأمازيغية / Nouvel An amazigh','official'],
  ['2027-01-24','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-25','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-26','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-27','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-28','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-29','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-30','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-31','عطلة منتصف السنة / Vacances de mi-année','official'],
  ['2027-03-21','العطلة البينية الثالثة / Vacances intercalaires 3','official'],['2027-03-22','العطلة البينية الثالثة / Vacances intercalaires 3','official'],['2027-03-23','العطلة البينية الثالثة / Vacances intercalaires 3','official'],['2027-03-24','العطلة البينية الثالثة / Vacances intercalaires 3','official'],['2027-03-25','العطلة البينية الثالثة / Vacances intercalaires 3','official'],['2027-03-26','العطلة البينية الثالثة / Vacances intercalaires 3','official'],['2027-03-27','العطلة البينية الثالثة / Vacances intercalaires 3','official'],['2027-03-28','العطلة البينية الثالثة / Vacances intercalaires 3','official'],
  ['2027-05-01','عيد الشغل / Fête du Travail','official'],
  ['2027-05-09','العطلة البينية الرابعة / Vacances intercalaires 4','official'],['2027-05-10','العطلة البينية الرابعة / Vacances intercalaires 4','official'],['2027-05-11','العطلة البينية الرابعة / Vacances intercalaires 4','official'],['2027-05-12','العطلة البينية الرابعة / Vacances intercalaires 4','official'],['2027-05-13','العطلة البينية الرابعة / Vacances intercalaires 4','official'],['2027-05-14','العطلة البينية الرابعة / Vacances intercalaires 4','official'],['2027-05-15','العطلة البينية الرابعة / Vacances intercalaires 4','official'],['2027-05-16','العطلة البينية الرابعة / Vacances intercalaires 4','official'],
  [null,'عيد الفطر: من 29 رمضان إلى 2 شوال 1448 (حسب الرؤية)','religious'],[null,'عيد الأضحى: من 9 إلى 11 ذي الحجة 1448 (حسب الرؤية)','religious'],[null,'فاتح محرم 1449 (حسب الرؤية)','religious']
 ];
 const ins=db.prepare('INSERT INTO holidays(id,institution_id,school_year,date,label,kind) VALUES(?,?,?,?,?,?)');
 fixed.forEach(x=>ins.run(id(),instId,schoolYear,x[0],x[1],x[2]));
}

function localDateParts(now){
 const d=new Date(now||Date.now());
 const pad=n=>String(n).padStart(2,'0');
 return {date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`,iso:d.toISOString()};
}
function syncTeacherScheduleForDate(teacherId,date){
 const d=new Date(date+'T12:00:00'); if(Number.isNaN(d.getTime())) return;
 const dow=d.getDay();
 const slots=db.prepare(`SELECT tt.*,c.name class_name FROM timetable tt JOIN classes c ON c.id=tt.class_id WHERE tt.teacher_id=? AND tt.day_of_week=? AND c.institution_id=(SELECT institution_id FROM users WHERE id=?)`).all(teacherId,String(dow),teacherId);
 seedTeacherHolidays(db.prepare('SELECT institution_id FROM users WHERE id=?').get(teacherId)?.institution_id);
 const ins=db.prepare('SELECT * FROM holidays WHERE institution_id=(SELECT institution_id FROM users WHERE id=?) AND date=? LIMIT 1').get(teacherId,date);
 if(ins){db.prepare("DELETE FROM sessions WHERE teacher_id=? AND session_date=? AND status='planned'").run(teacherId,date);return;}
 // Remove only untouched planned sessions whose timetable slot no longer exists; preserve started/completed history.
 const planned=db.prepare("SELECT id,class_id,start_time FROM sessions WHERE teacher_id=? AND session_date=? AND status='planned'").all(teacherId,date);
 const slotKeys=new Set(slots.map(x=>`${x.class_id}|${x.start_time}`));
 for(const s of planned)if(!slotKeys.has(`${s.class_id}|${s.start_time}`))db.prepare('DELETE FROM sessions WHERE id=?').run(s.id);
 for(const tt of slots){
   const exists=db.prepare('SELECT id FROM sessions WHERE teacher_id=? AND class_id=? AND session_date=? AND start_time=? LIMIT 1').get(teacherId,tt.class_id,date,tt.start_time);
   if(exists)continue;
   const unit=db.prepare('SELECT un.id,un.title,un.sport,un.objective,un.session_count,un.start_date,un.end_date FROM units un JOIN annual_plans ap ON ap.id=un.plan_id WHERE un.class_id=? AND ap.teacher_id=? AND (un.start_date IS NULL OR un.start_date<=?) AND (un.end_date IS NULL OR un.end_date>=?) ORDER BY CASE WHEN un.start_date IS NULL THEN 1 ELSE 0 END,un.start_date ASC,un.cycle ASC,un.created_at ASC LIMIT 1').get(tt.class_id,teacherId,date,date);
   db.prepare('INSERT INTO sessions(id,unit_id,class_id,teacher_id,session_date,start_time,end_time,objective,content,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id(),unit?.id||null,tt.class_id,teacherId,date,tt.start_time,tt.end_time,unit?.objective||null,'','planned',new Date().toISOString());
 }
}

function syncTeacherSessions(teacherId,nowValue){
 const now=localDateParts(nowValue);
 const rows=db.prepare("SELECT s.*,c.name class_name FROM sessions s JOIN classes c ON c.id=s.class_id WHERE s.teacher_id=? AND s.session_date=? AND s.status IN ('planned','in_progress') ORDER BY s.start_time").all(teacherId,now.date);
 for(const s of rows){
   if(!s.session_date) continue;
   const ended = s.end_time && s.end_time<=now.time;
   if(!ended) continue;
   if(s.status==='in_progress'){
     db.prepare("UPDATE sessions SET status='completed',ended_at=? WHERE id=? AND status='in_progress'").run(now.iso,s.id);
     const lb=s.logbook_entry_id?db.prepare('SELECT id FROM logbook_entries WHERE id=?').get(s.logbook_entry_id):db.prepare('SELECT id FROM logbook_entries WHERE session_id=?').get(s.id);
     if(lb) db.prepare("UPDATE logbook_entries SET status='completed',content=?,reason=NULL WHERE id=?").run(s.objective||s.content||'',lb.id);
     else { const lid=id(); db.prepare('INSERT INTO logbook_entries(id,teacher_id,class_id,entry_date,horaire,content,remark,status,reason,session_id) VALUES(?,?,?,?,?,?,?,?,?,?)').run(lid,teacherId,s.class_id,s.session_date,`${s.start_time||''}${s.end_time?' – '+s.end_time:''}`,s.objective||s.content||'', '', 'completed', null,s.id); db.prepare('UPDATE sessions SET logbook_entry_id=? WHERE id=?').run(lid,s.id); }
     audit({id:teacherId},'AUTO_END','session',s.id,{status:'completed'});
   } else {
     db.prepare("UPDATE sessions SET status='needs_reason' WHERE id=? AND status='planned'").run(s.id);
     const exists=db.prepare("SELECT id FROM notifications WHERE user_id=? AND type='session_missed' AND related_id=? LIMIT 1").get(teacherId,s.id);
     if(!exists){
       const l=locale({headers:{'x-language':'ar'}});
       db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),teacherId,tr(l,'حصة غير منجزة — يرجى إدخال السبب','Séance non réalisée — veuillez indiquer le motif','Session not held — please enter the reason'),'الحصة لم تبدأ '+s.class_name+' بتاريخ '+s.session_date,'session_missed',null,now.iso,s.id);
     }
   }
 }
}

function basePublicUrl(req){const proto=(req.headers['x-forwarded-proto']||'http').split(',')[0].trim();const host=req.headers['x-forwarded-host']||req.headers.host||'localhost';return `${proto}://${host}`;}
async function route(req,res){
 const routePath=(req.url||'').split('?')[0];
 const limit=routePath==='/api/login'||routePath==='/api/password-reset'?20:120;
 if(!rateLimit(req,routePath,limit,60000)) return json(res,429,{error:'طلبات كثيرة جداً. يرجى المحاولة لاحقاً.'});
 const url=new URL(req.url,`http://${req.headers.host}`), p=url.pathname, method=req.method, u=auth(req);
 // Public, one-time student/guardian intake: token possession is the credential; no existing private data is returned.
 if(p.startsWith('/api/public/student-intake/')&&method==='GET'){
   const token=p.split('/').pop()||'';
   const th=crypto.createHash('sha256').update(token).digest('hex');
   const link=db.prepare(`SELECT l.*,s.first_name,s.last_name,s.massar_number,c.name class_name FROM student_intake_links l JOIN students s ON s.id=l.student_id JOIN classes c ON c.id=s.class_id WHERE l.token_hash=? AND l.active=1 AND l.expires_at>?`).get(th,new Date().toISOString());
   if(!link)return json(res,404,{error:'الرابط غير صالح أو انتهت صلاحيته'});
   return json(res,200,{student:{id:link.student_id,first_name:link.first_name,last_name:link.last_name,massar_number:link.massar_number,class_name:link.class_name},expires_at:link.expires_at});
 }
 if(p.startsWith('/api/public/student-intake/')&&method==='POST'){
   const token=p.split('/').pop()||'';
   const th=crypto.createHash('sha256').update(token).digest('hex');
   const link=db.prepare(`SELECT l.*,s.* FROM student_intake_links l JOIN students s ON s.id=l.student_id WHERE l.token_hash=? AND l.active=1 AND l.expires_at>?`).get(th,new Date().toISOString());
   if(!link)return json(res,404,{error:'الرابط غير صالح أو انتهت صلاحيته'});
   const b=await body(req),profile={};
   const fields=['guardian_name','guardian_relation','guardian_phone','emergency_phone','family_address','blood_group','allergies','chronic_conditions','medications','previous_injuries','eps_restrictions','doctor_name','doctor_phone','medical_details'];
   for(const k of fields)profile[k]=String(b[k]??'').trim();
   let photo=b.photo_path||null;
   if(photo&&String(photo).length>900000)return json(res,413,{error:'الصورة كبيرة جداً'});
   const merged={};try{Object.assign(merged,link.profile_json?JSON.parse(link.profile_json):{})}catch{} Object.assign(merged,profile);
   db.prepare('UPDATE students SET photo_path=COALESCE(?,photo_path),profile_json=? WHERE id=?').run(photo,JSON.stringify(merged),link.student_id);
   db.prepare('UPDATE student_intake_links SET active=0,used_at=? WHERE id=?').run(new Date().toISOString(),link.id);
   audit({id:link.student_id},'PUBLIC_INTAKE','student',link.student_id,{fields:fields.filter(k=>profile[k])});
   return json(res,200,{ok:true,message:'تم إرسال المعطيات بنجاح'});
 }
 // Shared student self-service portal: one persistent link for all students managed by the teacher.
 if(p.startsWith('/api/public/student-portal/')&&method==='GET'){
   const token=p.split('/').pop()||'';
   const th=crypto.createHash('sha256').update(token).digest('hex');
   const portal=db.prepare(`SELECT l.id,l.teacher_id,u.full_name teacher_name,i.name institution_name FROM student_portal_links l JOIN users u ON u.id=l.teacher_id LEFT JOIN institutions i ON i.id=u.institution_id WHERE l.token_hash=? AND l.active=1`).get(th);
   if(!portal)return json(res,404,{error:'الرابط غير صالح أو تم إيقافه'});
   return json(res,200,{ok:true,teacher_name:portal.teacher_name||'',institution_name:portal.institution_name||''});
 }
 if(p.startsWith('/api/public/student-portal/')&&p.endsWith('/lookup')&&method==='POST'){
   const parts=p.split('/'),token=parts[parts.length-2]||'';
   const th=crypto.createHash('sha256').update(token).digest('hex');
   const portal=db.prepare(`SELECT l.id,l.teacher_id,u.institution_id FROM student_portal_links l JOIN users u ON u.id=l.teacher_id WHERE l.token_hash=? AND l.active=1 AND u.active=1 AND u.role='teacher'`).get(th);
   if(!portal)return json(res,404,{error:'الرابط غير صالح أو تم إيقافه'});
   const b=await body(req),massar=String(b.massar_number||'').trim(),name=String(b.full_name||'').trim();
   if(!massar||!name)return json(res,400,{error:'أدخل الاسم الكامل ورقم مسار'});
   const st=db.prepare(`SELECT s.*,c.name class_name,c.level class_level FROM students s JOIN classes c ON c.id=s.class_id WHERE s.massar_number=? AND c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?)) LIMIT 1`).get(massar,portal.institution_id,portal.teacher_id,portal.teacher_id);
   if(!st)return json(res,404,{error:'لم نجد هذا التلميذ في لوائح الأستاذ. تأكد من الاسم ورقم مسار.'});
   const profile={};try{Object.assign(profile,st.profile_json?JSON.parse(st.profile_json):{})}catch{}
   // Only return the student's own record after exact Massar + name verification.
   const normalize=v=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
   const expected=normalize(`${st.first_name||''} ${st.last_name||''}`),alt=normalize(`${st.last_name||''} ${st.first_name||''}`);
   if(normalize(name)!==expected && normalize(name)!==alt)return json(res,403,{error:'الاسم لا يطابق رقم مسار المسجل. تأكد من المعطيات.'});
   return json(res,200,{student:{id:st.id,massar_number:st.massar_number,first_name:st.first_name,last_name:st.last_name,dob:st.dob,gender:st.gender,birth_place:st.birth_place,photo_path:st.photo_path,health_note:st.health_note,eps_note:st.eps_note,class_id:st.class_id,class_name:st.class_name,class_level:st.class_level,profile}});
 }
 if(p.startsWith('/api/public/student-portal/')&&p.endsWith('/save')&&method==='POST'){
   const parts=p.split('/'),token=parts[parts.length-2]||'';
   const th=crypto.createHash('sha256').update(token).digest('hex');
   const portal=db.prepare(`SELECT l.id,l.teacher_id,u.institution_id FROM student_portal_links l JOIN users u ON u.id=l.teacher_id WHERE l.token_hash=? AND l.active=1 AND u.active=1 AND u.role='teacher'`).get(th);
   if(!portal)return json(res,404,{error:'الرابط غير صالح أو تم إيقافه'});
   const b=await body(req),massar=String(b.massar_number||'').trim(),name=String(b.full_name||'').trim();
   const st=db.prepare(`SELECT s.*,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.massar_number=? AND c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?)) LIMIT 1`).get(massar,portal.institution_id,portal.teacher_id,portal.teacher_id);
   if(!st)return json(res,404,{error:'التلميذ غير موجود في لائحة الأستاذ'});
   const normalize=v=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
   const expected=normalize(`${st.first_name||''} ${st.last_name||''}`),alt=normalize(`${st.last_name||''} ${st.first_name||''}`);
   if(!name || (normalize(name)!==expected && normalize(name)!==alt))return json(res,403,{error:'الاسم ورقم مسار غير متطابقين'});
   const fields=['guardian_name','guardian_relation','guardian_phone','emergency_phone','family_address','blood_group','allergies','chronic_conditions','medications','previous_injuries','eps_restrictions','doctor_name','doctor_phone','medical_details'];
   const current={};try{Object.assign(current,st.profile_json?JSON.parse(st.profile_json):{})}catch{}
   const incoming={};for(const k of fields)incoming[k]=String(b[k]??'').trim();
   Object.assign(current,incoming);
   let photo=b.photo_path||null;if(photo&&String(photo).length>900000)return json(res,413,{error:'الصورة كبيرة جداً، اختر صورة أصغر.'});
   db.prepare('UPDATE students SET photo_path=COALESCE(?,photo_path),profile_json=? WHERE id=?').run(photo,JSON.stringify(current),st.id);
   audit({id:portal.teacher_id},'PUBLIC_PORTAL_UPDATE','student',st.id,{fields:fields.filter(k=>incoming[k])});
   return json(res,200,{ok:true,message:'تم حفظ ملفك بنجاح',student:{id:st.id,class_name:st.class_name,massar_number:st.massar_number,first_name:st.first_name,last_name:st.last_name}});
 }
 // Teacher creates/reuses one shared link for all students.
 if(p==='/api/teacher/student-portal-link'&&method==='POST'&&u?.role==='teacher'){
   const existing=db.prepare('SELECT * FROM student_portal_links WHERE teacher_id=? AND active=1 LIMIT 1').get(u.id);
   if(existing){const raw=revealPortalToken(existing);if(raw)return json(res,200,{url:`${basePublicUrl(req)}/?student_portal=${raw}`,rotated:false,reused:true});}
   const raw=crypto.randomBytes(32).toString('hex'),hash=crypto.createHash('sha256').update(raw).digest('hex'),sealed=protectPortalToken(raw),lid=id();
   db.prepare('INSERT INTO student_portal_links(id,teacher_id,token_hash,token_iv,token_tag,token_cipher,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(lid,u.id,hash,sealed.iv,sealed.tag,sealed.cipher,1,new Date().toISOString(),new Date().toISOString());
   audit(u,'CREATE','student_portal_link',lid,{});
   return json(res,201,{url:`${basePublicUrl(req)}/?student_portal=${raw}`,rotated:false});
 }
 if(p==='/api/teacher/student-portal-link'&&method==='DELETE'&&u?.role==='teacher'){db.prepare('UPDATE student_portal_links SET active=0,updated_at=? WHERE teacher_id=?').run(new Date().toISOString(),u.id);return json(res,200,{ok:true})}
 if(p==='/api/login'&&method==='POST'){const l=locale(req),b=await body(req),x=db.prepare('SELECT * FROM users WHERE username=?').get(b.username||''); if(!x||!x.active||!verify(b.password||'',x.password_hash))return json(res,401,{error:tr(l,'اسم المستخدم أو كلمة المرور غير صحيحة','Nom d’utilisateur ou mot de passe incorrect','Incorrect username or password')}); if(x.institution_id){const inst=db.prepare('SELECT subscription_status,trial_ends_on FROM institutions WHERE id=?').get(x.institution_id); const today=new Date().toISOString().slice(0,10); const activeSub=db.prepare("SELECT 1 FROM subscriptions WHERE institution_id=? AND status='active' AND (ends_on IS NULL OR ends_on>=?) LIMIT 1").get(x.institution_id,today); x.subscription_state=activeSub?'active':(inst?.subscription_status==='trial'&&inst?.trial_ends_on&&inst.trial_ends_on>=today?'trial':(inst?.subscription_status==='expired'||inst?.subscription_status==='trial_expired'?'expired':'unpaid')); x.billing_only=x.subscription_state==='expired'||x.subscription_state==='unpaid'; } const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{userId:x.id,created:Date.now()});res.setHeader('Set-Cookie',`eps_session=${token}; HttpOnly; SameSite=Lax; Path=/`);audit(x,'LOGIN','user',x.id,{});return json(res,200,{user:{id:x.id,username:x.username,role:x.role,full_name:x.full_name,institution_id:x.institution_id,force_password_change:!!x.force_password_change,onboarding_complete:!!x.onboarding_complete,subscription_state:x.subscription_state||'active',billing_only:!!x.billing_only}})}
 if(p==='/api/logout'&&method==='POST'){const c=parseCookies(req);const x=sessions.get(c.eps_session);if(x){audit(u,'LOGOUT','user',x.userId,{});sessions.delete(c.eps_session)}res.setHeader('Set-Cookie','eps_session=; Max-Age=0; Path=/');return json(res,200,{ok:true})}
 if(p==='/api/me'){if(!u)return json(res,401,{error:'غير مسجل'});return json(res,200,{user:{id:u.id,username:u.username,role:u.role,full_name:u.full_name,institution_id:u.institution_id,force_password_change:!!u.force_password_change,onboarding_complete:!!u.onboarding_complete,subscription_state:u.subscription_state||'active',billing_only:!!u.billing_only},institutions:institutionScope(u)})}
 if(p==='/api/teacher/onboarding'&&method==='GET'){if(u.role!=='teacher')return deny(res);const profile=db.prepare('SELECT * FROM teacher_profiles WHERE user_id=?').get(u.id)||{};const classes=db.prepare('SELECT COUNT(*) c FROM classes WHERE institution_id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))').get(u.institution_id,u.id,u.id).c;const timetable=db.prepare('SELECT COUNT(*) c FROM timetable WHERE teacher_id=? AND institution_id=?').get(u.id,u.institution_id).c;return json(res,200,{complete:!!u.onboarding_complete,profile,classes,timetable});}
 if(p==='/api/teacher/onboarding'&&method==='POST'){if(u.role!=='teacher')return deny(res);const b=await body(req);const cur=db.prepare('SELECT * FROM teacher_profiles WHERE user_id=?').get(u.id);if(cur) db.prepare('UPDATE teacher_profiles SET gender=?,dob=?,grade=?,specialization=?,payroll_number=?,seniority=?,professional_summary=? WHERE user_id=?').run(b.gender??cur.gender,b.dob??cur.dob,b.grade??cur.grade,b.specialization??cur.specialization,b.payroll_number??cur.payroll_number,b.seniority??cur.seniority,b.professional_summary??cur.professional_summary,u.id);else db.prepare('INSERT INTO teacher_profiles(user_id,gender,dob,grade,specialization,payroll_number,seniority,professional_summary) VALUES(?,?,?,?,?,?,?,?)').run(u.id,b.gender||null,b.dob||null,b.grade||null,b.specialization||null,b.payroll_number||null,b.seniority||null,b.professional_summary||null);db.prepare('UPDATE users SET onboarding_complete=1 WHERE id=?').run(u.id);audit(u,'COMPLETE','teacher_onboarding',u.id,{});return json(res,200,{ok:true,onboarding_complete:true});}
 if(p==='/api/password-reset'&&method==='POST'){const l=locale(req),b=await body(req);if(!b.username||!b.contact)return json(res,400,{error:tr(l,'يرجى إدخال اسم المستخدم ورقم الهاتف أو البريد الإلكتروني.','Veuillez saisir le nom d’utilisateur et le numéro de téléphone ou l’e-mail.','Please enter the username and phone number or email.')});const x=db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(String(b.username).trim());if(!x)return json(res,400,{error:tr(l,'بيانات التحقق غير صحيحة.','Les informations de vérification sont incorrectes.','The verification details are incorrect.')});const contact=String(b.contact).trim().toLowerCase();const email=String(x.email||'').trim().toLowerCase();const phone=String(x.phone||'').trim().toLowerCase();if(contact!==email&&contact!==phone)return json(res,400,{error:tr(l,'بيانات التحقق غير صحيحة.','Les informations de vérification sont incorrectes.','The verification details are incorrect.')});const temp=crypto.randomBytes(6).toString('base64url').slice(0,10);db.prepare('UPDATE users SET password_hash=?,force_password_change=1 WHERE id=?').run(hash(temp),x.id);audit(x,'PASSWORD_RESET_REQUEST','user',x.id,{delivery:contact.includes('@')?'email':'phone'});const destination=contact.includes('@')?contact.replace(/(^.).*(@.*$)/,'$1••••$2'):contact.length>4?contact.slice(0,3)+'••••'+contact.slice(-2):'••••';return json(res,200,{ok:true,message:tr(l,'تم إنشاء كلمة مرور مؤقتة. سيتم إرسالها إلى وسيلة الاتصال المرتبطة بالحساب.','Un mot de passe temporaire a été généré. Il sera envoyé au moyen de contact associé au compte.','A temporary password has been generated and will be sent to the contact method associated with the account.'),destination,...(process.env.NODE_ENV==='development'?{local_password:temp}:{})})}
if(p==='/api/join-requests'&&method==='POST'){
  const l=locale(req),b=await body(req); const email=String(b.email||'').trim().toLowerCase(), phone=String(b.phone||'').trim();
  if(!b.full_name||!email||!phone||!b.institution_name)return json(res,400,{error:tr(l,'يرجى إكمال الاسم والبريد الإلكتروني والهاتف واسم المؤسسة.','Veuillez compléter le nom, l’e-mail, le téléphone et l’établissement.','Please complete your name, email, phone and institution.')});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(res,400,{error:tr(l,'البريد الإلكتروني غير صحيح.','E-mail invalide.','Invalid email address.')});
  const already=db.prepare('SELECT tr.*,u.username FROM trial_registrations tr LEFT JOIN users u ON u.id=tr.account_id WHERE lower(tr.email)=lower(?) OR tr.phone=? LIMIT 1').get(email,phone);
  const existingUser=db.prepare('SELECT id,username FROM users WHERE lower(email)=lower(?) OR phone=? LIMIT 1').get(email,phone);
  if(already||existingUser)return json(res,409,{error:tr(l,'هذا البريد الإلكتروني أو رقم الهاتف مرتبط بحساب سابق. يرجى تسجيل الدخول بالحساب نفسه بدل إنشاء تجربة جديدة.','Cet e-mail ou numéro est déjà associé à un compte. Connectez-vous avec ce compte au lieu de créer un nouvel essai.','This email or phone number is already linked to an account. Sign in with the existing account instead of starting another trial.'),code:'TRIAL_ALREADY_USED'});
  const requestedRole=['teacher','inspector','coordinator'].includes(b.requested_role)?b.requested_role:'teacher';
  let inst=db.prepare('SELECT * FROM institutions WHERE lower(name)=lower(?) LIMIT 1').get(String(b.institution_name).trim());
  if(!inst){const iid=id(),code='EPS'+crypto.randomBytes(3).toString('hex').toUpperCase();db.prepare('INSERT INTO institutions(id,name,code,subscription_status,trial_ends_on) VALUES(?,?,?,?,?)').run(iid,String(b.institution_name).trim(),code,'trial',new Date(Date.now()+7*86400000).toISOString().slice(0,10));inst=db.prepare('SELECT * FROM institutions WHERE id=?').get(iid);}
  else if(inst.subscription_status==='active' && db.prepare("SELECT 1 FROM subscriptions WHERE institution_id=? AND status='active' LIMIT 1").get(inst.id))return json(res,409,{error:tr(l,'المؤسسة لديها اشتراك نشط. تواصل مع منسق المؤسسة للحصول على حسابك.','Cet établissement possède déjà un abonnement actif. Contactez son coordinateur pour obtenir votre compte.','This institution already has an active subscription. Contact its coordinator for your account.')});
  const starts=new Date(), ends=new Date(starts.getTime()+7*86400000), sid=id(),rid=id(),uid=id();
  if(inst.subscription_status!=='trial'){db.prepare("UPDATE institutions SET subscription_status='trial',trial_ends_on=? WHERE id=?").run(ends.toISOString().slice(0,10),inst.id);}
  db.prepare("INSERT INTO subscriptions(id,institution_id,plan,starts_on,ends_on,status,created_at,amount,paid_amount,payment_status) VALUES(?,?,?,?,?,?,?,?,?,?)").run(sid,inst.id,'7-day trial',starts.toISOString().slice(0,10),ends.toISOString().slice(0,10),'trial',new Date().toISOString(),0,0,'trial');
  const base=(requestedRole==='teacher'?'teacher_':requestedRole==='inspector'?'insp_':'coord_')+inst.code.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10);let username=base,n=1;while(db.prepare('SELECT 1 FROM users WHERE username=?').get(username))username=base+(n++);
  const temp=crypto.randomBytes(8).toString('base64url');db.prepare('INSERT INTO users(id,username,password_hash,role,full_name,email,phone,institution_id,active,force_password_change,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(uid,username,hash(temp),requestedRole,b.full_name,email,phone,inst.id,1,1,new Date().toISOString());
  db.prepare('INSERT INTO trial_registrations(id,email,phone,account_id,institution_id,started_on,ends_on,status) VALUES(?,?,?,?,?,?,?,?)').run(id(),email,phone,uid,inst.id,starts.toISOString().slice(0,10),ends.toISOString().slice(0,10),'active');
  db.prepare('INSERT INTO join_requests(id,full_name,email,phone,requested_role,institution_name,message,status,institution_id,subscription_id,account_id,payment_status,subscription_end,username,paid_amount) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(rid,b.full_name,email,phone,requestedRole,b.institution_name,b.message||null,'trial',inst.id,sid,uid,'trial',ends.toISOString().slice(0,10),username,0);
  const bodyText=`EPS PILOT\n\nVotre essai gratuit de 7 jours est activé.\nNom d’utilisateur: ${username}\nMot de passe temporaire: ${temp}\nFin de l’essai: ${ends.toISOString().slice(0,10)}\n\nAprès l’essai, connectez-vous avec le même compte pour vous abonner.`; const delivery=await sendAccountEmail(email,'EPS PILOT — votre essai gratuit de 7 jours',bodyText,rid);
  audit(null,'TRIAL_STARTED','subscription',sid,{account_id:uid,institution_id:inst.id});
  return json(res,201,{ok:true,id:rid,trial:true,username,temp_password:temp,full_name:b.full_name,institution_name:inst.name,subscription:{id:sid,starts_on:starts.toISOString().slice(0,10),ends_on:ends.toISOString().slice(0,10),days:7},email_delivery:delivery.status,message:tr(l,'تم تفعيل التجربة المجانية لمدة 7 أيام. احتفظ بنفس الحساب؛ عند انتهاء التجربة يمكنك الاشتراك دون إنشاء بريد إلكتروني جديد.','Votre essai gratuit de 7 jours est activé. Conservez le même compte ; à la fin de l’essai, vous pourrez vous abonner sans créer un nouvel e-mail.','Your 7-day free trial is active. Keep the same account; when the trial ends, you can subscribe without creating a new email.')});
}
 if(p.startsWith('/api/join-requests/')&&method==='POST'&&p.endsWith('/card-payment')){
   const rid=p.split('/')[3]; const r=db.prepare('SELECT * FROM join_requests WHERE id=?').get(rid); if(!r)return json(res,404,{error:'طلب الاشتراك غير موجود'});
   if(r.status==='account_created'&&r.account_id){const acc=db.prepare('SELECT * FROM users WHERE id=?').get(r.account_id);return json(res,200,{id:acc.id,username:acc.username,temp_password:'—',full_name:acc.full_name,email:acc.email,institution_name:r.institution_name,subscription:{amount:r.paid_amount,paid_amount:r.paid_amount,ends_on:r.subscription_end},request_id:r.id});}
   const b=await body(req), digits=String(b.card_number||'').replace(/\D/g,'');
   if(digits.length<12||digits.length>19||!String(b.card_name||'').trim()||!/^(0[1-9]|1[0-2])\/?\d{2}$/.test(String(b.expiry||''))||!/^[0-9]{3,4}$/.test(String(b.cvc||''))) return json(res,400,{error:'بيانات البطاقة غير مكتملة أو غير صحيحة'});
   try{
     // No card number/CVV is stored. A production gateway can be connected through PAYMENT_CARD_WEBHOOK_URL.
     const gateway=process.env.PAYMENT_CARD_WEBHOOK_URL;
     if(gateway){const gr=await fetch(gateway,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:rid,amount:Number(db.prepare('SELECT institution_price FROM owner_pricing WHERE id=1').get().institution_price||1200),currency:'MAD',cardholder:b.card_name,last4:digits.slice(-4),expiry:b.expiry})});if(!gr.ok)return json(res,402,{error:'تعذر تأكيد الأداء عبر بوابة البطاقة'});}
     const out=createPaidAccountFromRequest(r,null); const subject='بيانات حساب EPS PILOT وتأكيد الاشتراك'; const bodyText=`مرحباً ${out.full_name}\n\nتم تفعيل اشتراك مؤسستكم في EPS PILOT.\nاسم المستخدم: ${out.username}\nكلمة المرور المؤقتة: ${out.temp_password}\nتاريخ انتهاء الاشتراك: ${out.subscription.ends_on}\n\nعند أول دخول يجب تغيير كلمة المرور.`; const delivery=await sendAccountEmail(out.email,subject,bodyText,r.id); audit(null,'CARD_PAYMENT_CONFIRMED','subscription_request',r.id,{account_id:out.id,subscription_id:out.subscription.id,last4:digits.slice(-4),email_delivery:delivery.status}); return json(res,201,{...out,email_delivery:delivery.status,payment:'paid'});
   }catch(e){return json(res,500,{error:'تعذر إتمام الأداء وتفعيل الحساب: '+e.message})}
 }
 if(p==='/api/trial/subscribe'&&method==='POST'){
   const l=locale(req); if(!u?.institution_id)return json(res,400,{error:'المؤسسة غير مرتبطة بالحساب'});
   const b=await body(req), digits=String(b.card_number||'').replace(/\D/g,'');
   if(digits.length<12||digits.length>19||!String(b.card_name||'').trim()||!/^(0[1-9]|1[0-2])\/?\d{2}$/.test(String(b.expiry||''))||!/^[0-9]{3,4}$/.test(String(b.cvc||'')))return json(res,400,{error:'بيانات البطاقة غير مكتملة أو غير صحيحة'});
   const inst=db.prepare('SELECT * FROM institutions WHERE id=?').get(u.institution_id); if(!inst)return json(res,404,{error:'المؤسسة غير موجودة'});
   const price=Number(db.prepare('SELECT institution_price FROM owner_pricing WHERE id=1').get()?.institution_price||1200), plan=db.prepare('SELECT plan_name FROM owner_pricing WHERE id=1').get()?.plan_name||'Institution Pro';
   const gateway=process.env.PAYMENT_CARD_WEBHOOK_URL; if(gateway){try{const gr=await fetch(gateway,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account_id:u.id,institution_id:inst.id,amount:price,currency:'MAD',cardholder:b.card_name,last4:digits.slice(-4),expiry:b.expiry})});if(!gr.ok)return json(res,402,{error:'تعذر تأكيد الأداء عبر بوابة البطاقة'});}catch{return json(res,502,{error:'تعذر الاتصال ببوابة الأداء'})}}
   const today=new Date(),ends=new Date(today.getTime()+365*86400000),sid=id();db.prepare("UPDATE subscriptions SET status='expired',payment_status='trial_converted' WHERE institution_id=? AND status='trial'").run(inst.id);db.prepare("INSERT INTO subscriptions(id,institution_id,plan,starts_on,ends_on,status,created_at,amount,paid_amount,payment_status) VALUES(?,?,?,?,?,?,?,?,?,?)").run(sid,inst.id,plan,today.toISOString().slice(0,10),ends.toISOString().slice(0,10),'active',new Date().toISOString(),price,price,'paid');db.prepare("UPDATE institutions SET subscription_status='active',trial_ends_on=NULL WHERE id=?").run(inst.id);db.prepare("UPDATE trial_registrations SET status='converted' WHERE account_id=? AND status IN ('active','expired')").run(u.id);audit(u,'TRIAL_CONVERTED','subscription',sid,{amount:price});return json(res,201,{ok:true,subscription:{id:sid,plan,amount:price,ends_on:ends.toISOString().slice(0,10)}});
 }
 if(p==='/api/public/pricing'&&method==='GET'){const x=db.prepare('SELECT plan_name,institution_price FROM owner_pricing WHERE id=1').get();return json(res,200,{plan_name:x?.plan_name||'Institution Pro',institution_price:Number(x?.institution_price||1200),currency:'MAD'});}
 if(p==='/api/billing/payment-webhook'&&method==='POST'){
   const secret=req.headers['x-payment-secret']; if(!process.env.PAYMENT_WEBHOOK_SECRET || secret!==process.env.PAYMENT_WEBHOOK_SECRET)return deny(res,'غير مصرح');
   const b=await body(req); if(b.status!=='paid'||!b.request_id)return json(res,400,{error:'بيانات الأداء غير مكتملة'});
   const r=db.prepare('SELECT * FROM join_requests WHERE id=?').get(b.request_id); if(!r)return json(res,404,{error:'طلب الاشتراك غير موجود'});
   try{const out=createPaidAccountFromRequest(r,null);const subject='بيانات حساب EPS PILOT وتأكيد الاشتراك';const bodyText=`مرحباً ${out.full_name}\n\nتم تفعيل اشتراك مؤسستكم في EPS PILOT.\nاسم المستخدم: ${out.username}\nكلمة المرور المؤقتة: ${out.temp_password}\nتاريخ انتهاء الاشتراك: ${out.subscription.ends_on}\n\nعند أول دخول يجب تغيير كلمة المرور.`;const delivery=await sendAccountEmail(out.email,subject,bodyText,r.id);return json(res,201,{ok:true,...out,email_delivery:delivery.status});}catch(e){return json(res,500,{error:'تعذر إتمام التفعيل: '+e.message})}
 }
 if(!u){const l=locale(req);return json(res,401,{error:tr(l,'يرجى تسجيل الدخول للمتابعة.','Veuillez vous connecter pour continuer.','Please sign in to continue.')})};
 if(u.billing_only && !['/api/me','/api/logout','/api/password','/api/account/contact'].includes(p) && !(p==='/api/trial/subscribe'&&method==='POST')){const l=locale(req);return json(res,402,{error:tr(l,'انتهت الفترة التجريبية. اشترك لمواصلة استخدام EPS PILOT.','Votre période d’essai est terminée. Abonnez-vous pour continuer à utiliser EPS PILOT.','Your trial has ended. Subscribe to continue using EPS PILOT.'),code:'TRIAL_EXPIRED',subscription_state:u.subscription_state})}
 if(p==='/api/account/contact'&&method==='PUT'){
   const b=await body(req); const email=b.email==null?'':String(b.email).trim(); const phone=b.phone==null?'':String(b.phone).trim();
   if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(res,400,{error:'البريد الإلكتروني غير صحيح.'});
   if(email && db.prepare('SELECT id FROM users WHERE lower(email)=lower(?) AND id<>?').get(email,u.id))return json(res,409,{error:'البريد الإلكتروني مستعمل من طرف حساب آخر.'});
   if(phone && db.prepare('SELECT id FROM users WHERE phone=? AND id<>?').get(phone,u.id))return json(res,409,{error:'رقم الهاتف مستعمل من طرف حساب آخر.'});
   db.prepare('UPDATE users SET email=?,phone=? WHERE id=?').run(email||null,phone||null,u.id); audit(u,'UPDATE','account_contact',u.id,{email:!!email,phone:!!phone}); const fresh=db.prepare('SELECT id,username,full_name,email,phone,role,institution_id FROM users WHERE id=?').get(u.id); return json(res,200,{ok:true,user:fresh});
 }
 if(p==='/api/password'&&method==='POST'){const b=await body(req);if(b.current_confirm!==undefined&&(b.current||'')!==(b.current_confirm||'')){const l=locale(req);return json(res,400,{error:tr(l,'تأكيد كلمة المرور الحالية غير مطابق.','La confirmation du mot de passe actuel est incorrecte.','Current password confirmation does not match.')})}if(!verify(b.current||'',u.password_hash)){const l=locale(req);return json(res,400,{error:tr(l,'كلمة المرور الحالية غير صحيحة.','Le mot de passe actuel est incorrect.','The current password is incorrect.')})}if(!b.next||b.next.length<8){const l=locale(req);return json(res,400,{error:tr(l,'يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.','Le nouveau mot de passe doit comporter au moins 8 caractères.','The new password must be at least 8 characters long.')})}db.prepare('UPDATE users SET password_hash=?,force_password_change=0 WHERE id=?').run(hash(b.next),u.id);audit(u,'PASSWORD_CHANGE','user',u.id,{});return json(res,200,{ok:true})}
 if(p==='/api/coordinator/overview'&&method==='GET'&&u.role==='coordinator'){
   const inst=db.prepare('SELECT * FROM institutions WHERE id=?').get(u.institution_id); const i=u.institution_id;
   const teachers=db.prepare("SELECT COUNT(*) c FROM users WHERE role='teacher' AND institution_id=? AND active=1").get(i).c;
   const classes=db.prepare('SELECT COUNT(*) c FROM classes WHERE institution_id=? AND active=1').get(i).c;
   const students=db.prepare('SELECT COUNT(*) c FROM students s JOIN classes c ON c.id=s.class_id WHERE c.institution_id=?').get(i).c;
   const equipment=db.prepare('SELECT COUNT(*) c FROM equipment WHERE institution_id=?').get(i).c;
   const facilities=db.prepare('SELECT COUNT(*) c FROM facilities WHERE institution_id=?').get(i).c;
   const income=db.prepare("SELECT COALESCE(SUM(amount),0) s FROM budget_transactions WHERE institution_id=? AND transaction_type='income'").get(i).s;
   const expense=db.prepare("SELECT COALESCE(SUM(amount),0) s FROM budget_transactions WHERE institution_id=? AND transaction_type='expense'").get(i).s;
   const openIncidents=db.prepare("SELECT (SELECT COUNT(*) FROM equipment_incidents WHERE institution_id=? AND status='open')+(SELECT COUNT(*) FROM facility_incidents WHERE institution_id=? AND status='open') c").get(i,i).c;
   return json(res,200,{institution:inst,teachers,classes,students,equipment,facilities,income,expense,balance:Number(income||0)-Number(expense||0),openIncidents});
 }
 if(p==='/api/dashboard'){const insts=institutionScope(u), ids=insts.map(x=>x.id);let out={institutions:insts.length,teachers:0,classes:0,students:0,sessions:0,reports:0};if(ids.length){const q=a=>db.prepare(a).get(...ids.map(()=>null));const ph=ids.map(()=>'?').join(',');out.teachers=db.prepare(`SELECT COUNT(*) c FROM users WHERE role='teacher' AND institution_id IN (${ph}) AND active=1`).get(...ids).c;out.classes=db.prepare(`SELECT COUNT(*) c FROM classes WHERE institution_id IN (${ph}) AND active=1`).get(...ids).c;out.students=db.prepare(`SELECT COUNT(*) c FROM students s JOIN classes c ON c.id=s.class_id WHERE c.institution_id IN (${ph})`).get(...ids).c;out.sessions=db.prepare(`SELECT COUNT(*) c FROM sessions s JOIN classes c ON c.id=s.class_id WHERE c.institution_id IN (${ph})`).get(...ids).c;}out.notifications=db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read_at IS NULL').get(u.id).c;return json(res,200,out)}
 // Institution
 // OWNER CONTROL CENTER
 if(p==='/api/institutions'&&method==='POST'&&u?.role==='owner'){
   const b=await body(req); if(!b.name)return json(res,400,{error:'اسم المؤسسة مطلوب'});
   const iid=id(); const code=b.code||('EPS'+Math.floor(100000+Math.random()*900000));
   try{
     db.prepare('INSERT INTO institutions(id,name,code,directorate,region,subscription_status) VALUES(?,?,?,?,?,?)').run(iid,b.name,code,b.directorate||null,b.region||null,'active');
     const price=Number(db.prepare('SELECT institution_price FROM owner_pricing WHERE id=1').get().institution_price||1200);
     const starts=new Date().toISOString().slice(0,10), ends=new Date(Date.now()+365*86400000).toISOString().slice(0,10), sid=id();
     db.prepare("INSERT INTO subscriptions(id,institution_id,plan,starts_on,ends_on,status,created_at,amount,paid_amount,payment_status) VALUES(?,?,?,?,?,?,?,?,?,?)").run(sid,iid,db.prepare('SELECT plan_name FROM owner_pricing WHERE id=1').get().plan_name,starts,ends,'active',new Date().toISOString(),price,0,'pending');
     const temp=crypto.randomBytes(8).toString('base64url'); const baseUsername=String(b.name||'').trim(); if(!baseUsername)return json(res,400,{error:'اسم المؤسسة مطلوب'}); let username=baseUsername,n=1; while(db.prepare('SELECT 1 FROM users WHERE lower(username)=lower(?)').get(username)){username=baseUsername+' '+(++n)}
     const uid=id(); db.prepare('INSERT INTO users(id,username,password_hash,role,full_name,email,phone,institution_id,active,force_password_change,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(uid,username,hash(temp),'coordinator','منسق '+b.name,b.email||null,b.phone||null,iid,1,1,new Date().toISOString());
     const inv=makeInvoice(sid,price), rec=makeReceipt(sid,0);
     audit(u,'CREATE','institution',iid,{subscription_id:sid,coordinator_id:uid});
     return json(res,201,{id:iid,username,temp_password:temp,institution_id:iid,subscription:{id:sid,amount:price,paid_amount:0,invoice:inv.number,receipt:rec.number}});
   }catch(e){return json(res,409,{error:'تعذر إنشاء المؤسسة: '+e.message})}
 }
 if(p.startsWith('/api/institutions/')&&u?.role==='owner'){
   const parts=p.split('/').filter(Boolean), iid=parts[2];
   if(parts.length===4&&parts[3]==='credentials'&&method==='GET'){
     const inst=db.prepare('SELECT * FROM institutions WHERE id=?').get(iid); if(!inst)return json(res,404,{error:'المؤسسة غير موجودة'});
     const c=db.prepare("SELECT * FROM users WHERE institution_id=? AND role='coordinator' ORDER BY created_at LIMIT 1").get(iid); if(!c)return json(res,404,{error:'لا يوجد حساب منسق'});
     const temp=crypto.randomBytes(8).toString('base64url');db.prepare('UPDATE users SET password_hash=?,force_password_change=1 WHERE id=?').run(hash(temp),c.id);audit(u,'RESET_PASSWORD','coordinator',c.id,{institution_id:iid});return json(res,200,{username:c.username,temp_password:temp,institution_name:inst.name,subscription:db.prepare('SELECT * FROM subscriptions WHERE institution_id=? ORDER BY created_at DESC LIMIT 1').get(iid)});
   }
   if(parts.length===3&&method==='PUT'){
     const b=await body(req); const oldInst=db.prepare('SELECT name FROM institutions WHERE id=?').get(iid); db.prepare('UPDATE institutions SET name=?,code=?,directorate=?,region=? WHERE id=?').run(b.name,b.code||null,b.directorate||null,b.region||null,iid); if(oldInst&&String(b.name||'').trim()&&String(oldInst.name||'').trim()!==String(b.name).trim()){db.prepare("UPDATE users SET username=? WHERE institution_id=? AND role='coordinator' AND lower(username)=lower(?)").run(String(b.name).trim(),iid,String(oldInst.name).trim());} audit(u,'UPDATE','institution',iid,b); return json(res,200,{ok:true});
   }
   if(parts.length===3&&method==='PATCH'){
     const b=await body(req); db.prepare('UPDATE institutions SET subscription_status=? WHERE id=?').run(b.active?'active':'inactive',iid); db.prepare('UPDATE users SET active=? WHERE institution_id=? AND role!=\'owner\'').run(b.active?1:0,iid); audit(u,b.active?'ACTIVATE':'DEACTIVATE','institution',iid,b); return json(res,200,{ok:true});
   }
   if(parts.length===3&&method==='DELETE'){
     try{ hardDeleteInstitution(iid); audit(u,'DELETE','institution',iid,{hard_delete:true,accounts_deleted:true}); return json(res,200,{ok:true,deleted:true,accounts_deleted:true}); }
     catch(e){ return json(res,500,{error:'تعذر حذف المؤسسة وجميع حساباتها',detail:e.message}); }
   }
 }
 if(p==='/api/owner/subscription-requests'&&method==='GET'&&u?.role==='owner'){
   const rows=db.prepare(`SELECT j.*,i.name institution_name,s.ends_on subscription_end,s.amount,s.paid_amount,u.username FROM join_requests j LEFT JOIN institutions i ON i.id=j.institution_id LEFT JOIN subscriptions s ON s.id=j.subscription_id LEFT JOIN users u ON u.id=j.account_id ORDER BY CASE j.status WHEN 'pending' THEN 0 ELSE 1 END,j.created_at DESC`).all();
   return json(res,200,rows);
 }
 if(p.startsWith('/api/owner/subscription-requests/')&&method==='POST'&&u?.role==='owner'&&p.endsWith('/pay')){
   const rid=p.split('/')[4],r=db.prepare('SELECT * FROM join_requests WHERE id=?').get(rid); if(!r)return json(res,404,{error:'طلب الاشتراك غير موجود'});
   if(r.status==='account_created'&&r.account_id){const acc=db.prepare('SELECT * FROM users WHERE id=?').get(r.account_id);return json(res,200,{id:acc.id,username:acc.username,temp_password:'—',full_name:acc.full_name,email:acc.email,institution_name:r.institution_name,subscription:{amount:r.paid_amount,paid_amount:r.paid_amount,ends_on:r.subscription_end},request_id:r.id});}
   try{const out=createPaidAccountFromRequest(r,u);const subject='بيانات حساب EPS PILOT وتأكيد الاشتراك';const bodyText=`مرحباً ${out.full_name}\n\nتم تفعيل اشتراك مؤسستكم في EPS PILOT.\nاسم المستخدم: ${out.username}\nكلمة المرور المؤقتة: ${out.temp_password}\nتاريخ انتهاء الاشتراك: ${out.subscription.ends_on}\n\nعند أول دخول يجب تغيير كلمة المرور.`;const delivery=await sendAccountEmail(out.email,subject,bodyText,r.id);audit(u,'PAYMENT_CONFIRMED','subscription_request',r.id,{account_id:out.id,subscription_id:out.subscription.id,email_delivery:delivery.status});return json(res,201,{...out,email_delivery:delivery.status});}catch(e){return json(res,500,{error:'تعذر إنشاء الحساب بعد تأكيد الأداء: '+e.message})}
 }
 if(p==='/api/owner/accounts'&&method==='GET'&&u?.role==='owner') return json(res,200,db.prepare(`SELECT u.id,u.username,u.role,u.full_name,u.email,u.phone,u.institution_id,u.active,i.name institution_name,(SELECT MAX(s.ends_on) FROM subscriptions s WHERE s.institution_id=u.institution_id AND s.status='active') subscription_end FROM users u LEFT JOIN institutions i ON i.id=u.institution_id WHERE u.role!='owner' ORDER BY CASE u.role WHEN 'coordinator' THEN 1 WHEN 'inspector' THEN 2 ELSE 3 END,u.full_name`).all());
 if(p==='/api/owner/accounts'&&method==='POST'&&u?.role==='owner'){
   const b=await body(req); if(!b.full_name||!['teacher','coordinator','inspector'].includes(b.role))return json(res,400,{error:'المعطيات الأساسية ناقصة'});
   const username=b.username?.trim()||((b.role==='teacher'?'teacher_':b.role==='coordinator'?'coord_':'insp_')+crypto.randomBytes(4).toString('hex'));
   if(db.prepare('SELECT id FROM users WHERE username=?').get(username))return json(res,409,{error:'اسم المستخدم موجود مسبقاً'});
   if(b.institution_id&&!db.prepare('SELECT id FROM institutions WHERE id=?').get(b.institution_id))return json(res,404,{error:'المؤسسة غير موجودة'});
   const uid=id(),temp=b.password||crypto.randomBytes(8).toString('base64url'); db.prepare('INSERT INTO users(id,username,password_hash,role,full_name,email,phone,institution_id,active,force_password_change,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(uid,username,hash(temp),b.role,b.full_name,b.email||null,b.phone||null,b.institution_id||null,1,1,new Date().toISOString());
   audit(u,'CREATE','user',uid,{role:b.role,institution_id:b.institution_id||null});
   let subscription=null;if(b.institution_id){const s=db.prepare('SELECT * FROM subscriptions WHERE institution_id=? ORDER BY created_at DESC LIMIT 1').get(b.institution_id);if(s)subscription={id:s.id,amount:s.amount,paid_amount:s.paid_amount,plan:s.plan};}
   return json(res,201,{id:uid,username,temp_password:temp,subscription});
 }
 if(p.startsWith('/api/owner/accounts/')&&u?.role==='owner'){
   const parts=p.split('/').filter(Boolean),uid=parts[3],action=parts[4];
   const x=db.prepare('SELECT * FROM users WHERE id=?').get(uid);
   if(!x)return json(res,404,{error:'الحساب غير موجود'});
   if(x.role==='owner')return deny(res,'لا يمكن تعديل مالك المنصة');
   if(action==='reset-password'&&method==='POST'){
     const temp=crypto.randomBytes(8).toString('base64url');
     db.prepare('UPDATE users SET password_hash=?,force_password_change=1 WHERE id=?').run(hash(temp),uid);
     audit(u,'RESET_PASSWORD','user',uid,{});
     return json(res,200,{username:x.username,temp_password:temp,full_name:x.full_name});
   }
   if(!action&&method==='GET')return json(res,200,{...x,password_hash:undefined,institutions:db.prepare('SELECT id,name FROM institutions ORDER BY name').all()});
   if(!action&&method==='PUT'){
     const b=await body(req);
     if(db.prepare('SELECT id FROM users WHERE username=? AND id!=?').get(b.username,uid))return json(res,409,{error:'اسم المستخدم موجود مسبقاً'});
     db.prepare('UPDATE users SET username=?,full_name=?,role=?,email=?,phone=?,institution_id=? WHERE id=?').run(b.username,b.full_name,b.role,b.email||null,b.phone||null,b.institution_id||null,uid);
     audit(u,'UPDATE','user',uid,{role:b.role,institution_id:b.institution_id||null});
     return json(res,200,{ok:true});
   }
   if(!action&&method==='PATCH'){
     const b=await body(req);db.prepare('UPDATE users SET active=? WHERE id=?').run(b.active?1:0,uid);
     audit(u,b.active?'ACTIVATE':'DEACTIVATE','user',uid,{});return json(res,200,{ok:true,active:!!b.active});
   }
   if(!action&&method==='DELETE'){
     try{hardDeleteUserAccount(uid)}catch(err){return json(res,500,{error:'تعذر حذف الحساب',detail:err.message})}
     audit(u,'DELETE','user',uid,{role:x.role,institution_id:x.institution_id,hard_delete:true});
     return json(res,200,{ok:true,deleted:true});
   }
 }
 if(p==='/api/owner/pricing'&&method==='GET'&&u?.role==='owner') return json(res,200,db.prepare('SELECT * FROM owner_pricing WHERE id=1').get());
 if(p==='/api/owner/pricing'&&method==='PUT'&&u?.role==='owner'){const b=await body(req);db.prepare('UPDATE owner_pricing SET institution_price=?,plan_name=? WHERE id=1').run(Number(b.institution_price||0),b.plan_name||'Institution Pro');audit(u,'UPDATE','pricing',1,b);return json(res,200,{ok:true});}
 if(p==='/api/owner/subscriptions'&&method==='GET'&&u?.role==='owner'){const rows=db.prepare(`SELECT s.*,i.name institution_name FROM subscriptions s JOIN institutions i ON i.id=s.institution_id WHERE i.subscription_status!='deleted' ORDER BY s.created_at DESC`).all();const summary=rows.reduce((a,r)=>{a.billed+=Number(r.amount||0);a.revenue+=Number(r.paid_amount||0);return a},{billed:0,revenue:0});return json(res,200,{rows,summary});}
 if(p.startsWith('/api/owner/subscriptions/')&&u?.role==='owner'&&method==='GET'){const sid=p.split('/').pop(),s=db.prepare('SELECT s.*,i.name institution_name FROM subscriptions s JOIN institutions i ON i.id=s.institution_id WHERE s.id=?').get(sid);if(!s)return json(res,404,{error:'الاشتراك غير موجود'});const inv=ensureInvoice(s.id,s.amount),rec=ensureReceipt(s.id,s.paid_amount);return json(res,200,{...s,invoice:inv,receipt:rec});}
 if(p.startsWith('/api/owner/subscriptions/')&&u?.role==='owner'&&method==='PATCH'){const sid=p.split('/').pop(),s=db.prepare('SELECT * FROM subscriptions WHERE id=?').get(sid);if(!s)return json(res,404,{error:'الاشتراك غير موجود'});const b=await body(req);const ends_on=b.ends_on||s.ends_on,amount=b.amount!=null?Number(b.amount):s.amount,paid_amount=b.paid_amount!=null?Number(b.paid_amount):s.paid_amount,status=b.status||'active';db.prepare('UPDATE subscriptions SET ends_on=?,amount=?,paid_amount=?,status=?,payment_status=? WHERE id=?').run(ends_on,amount,paid_amount,status,paid_amount>=amount?'paid':(paid_amount>0?'partial':'pending'),sid);if(status==='active'){db.prepare("UPDATE institutions SET subscription_status='active' WHERE id=?").run(s.institution_id);db.prepare("UPDATE users SET active=1 WHERE institution_id=? AND role!='owner'").run(s.institution_id);}audit(u,'RENEW','subscription',sid,{ends_on,amount,paid_amount,status});return json(res,200,{ok:true})}
 if(p==='/api/owner/finance'&&method==='GET'&&u?.role==='owner'){const ex=db.prepare("SELECT id,label,category,amount,expense_date date,reference,notes,'expense' type FROM platform_expenses").all();const rev=db.prepare("SELECT id,label,category,amount,revenue_date date,reference,notes,'revenue' type FROM owner_revenues").all();const sub=db.prepare("SELECT id,'اشتراكات' label,'اشتراك' category,paid_amount amount,starts_on date,NULL reference,'أداء اشتراك' notes,'revenue' type FROM subscriptions WHERE paid_amount>0").all();const rows=[...ex,...rev,...sub].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));const revenue=rows.filter(x=>x.type==='revenue').reduce((a,x)=>a+Number(x.amount||0),0),expenses=rows.filter(x=>x.type==='expense').reduce((a,x)=>a+Number(x.amount||0),0);return json(res,200,{rows,revenue,expenses,net:revenue-expenses});}
 if(p==='/api/owner/revenue'&&method==='POST'&&u?.role==='owner'){const b=await body(req),rid=id();db.prepare('INSERT INTO owner_revenues(id,label,category,amount,revenue_date,reference,notes,created_by) VALUES(?,?,?,?,?,?,?,?)').run(rid,b.label||'مدخول',b.category||'عام',Number(b.amount||0),b.revenue_date||new Date().toISOString().slice(0,10),b.reference||null,b.notes||null,u.id);audit(u,'CREATE','owner_revenue',rid,b);return json(res,201,{id:rid});}
 if(p==='/api/owner/reports'&&method==='GET'&&u?.role==='owner'){return json(res,200,{rows:db.prepare('SELECT * FROM owner_ai_reports ORDER BY created_at DESC LIMIT 100').all(),schedules:Object.fromEntries(db.prepare('SELECT period,active FROM owner_report_schedules').all().map(x=>[x.period,!!x.active]))});}
 if(p==='/api/owner/report-schedules'&&method==='PUT'&&u?.role==='owner'){const b=await body(req);db.prepare('INSERT INTO owner_report_schedules(period,active,updated_at) VALUES(?,?,?) ON CONFLICT(period) DO UPDATE SET active=excluded.active,updated_at=excluded.updated_at').run(b.period,b.active?1:0,new Date().toISOString());return json(res,200,{ok:true});}
 if(p==='/api/owner/reports/generate'&&method==='POST'&&u?.role==='owner'){const b=await body(req),period=b.period||'daily';const ov=ownerOverviewData();const content=aiOwnerSummary(period,ov);const rid=id();db.prepare('INSERT INTO owner_ai_reports(id,period,title,content) VALUES(?,?,?,?)').run(rid,period,`تقرير ${period==='daily'?'يومي':period==='weekly'?'أسبوعي':'شهري'} لمالك المنصة`,content);audit(u,'CREATE','ai_report',rid,{period});return json(res,201,{id:rid});}
 if(p.startsWith('/api/owner/reports/')&&method==='GET'&&u?.role==='owner'){const rid=p.split('/').pop();const r=db.prepare('SELECT * FROM owner_ai_reports WHERE id=?').get(rid);return r?json(res,200,r):json(res,404,{error:'التقرير غير موجود'});}
 if(p==='/api/owner/message-targets'&&method==='GET'&&u?.role==='owner')return json(res,200,db.prepare("SELECT u.id,u.full_name,u.role,u.institution_id,i.name institution_name FROM users u JOIN institutions i ON i.id=u.institution_id WHERE u.active=1 AND u.role IN ('teacher','coordinator') ORDER BY i.name,u.role,u.full_name").all());
 if(/^\/api\/(budgets|equipment|facilities)(\/|$)/.test(p)){
   const table=p.split('/')[2];
   const cols={budgets:['label','amount','spent','year_label'],equipment:['name','category','quantity','condition','notes'],facilities:['name','type','capacity','notes']}[table];
   if(cols){
     if(method==='GET'&&p===`/api/${table}`){if(!['coordinator','owner'].includes(u.role))return deny(res);const instId=u.role==='owner'?(url.searchParams.get('institution_id')||null):u.institution_id;if(u.role==='owner'&&!instId)return json(res,200,db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC`).all());return json(res,200,db.prepare(`SELECT * FROM ${table} WHERE institution_id=? ORDER BY rowid DESC`).all(instId));}
     if(method==='POST'&&p===`/api/${table}`){if(!['coordinator','owner'].includes(u.role))return deny(res);const b=await body(req);const instId=u.role==='owner'?(b.institution_id||null):u.institution_id;if(!instId)return json(res,400,{error:'المؤسسة مطلوبة'});const rid=id();const vals=cols.map(k=>b[k]??(k==='spent'?0:null));db.prepare(`INSERT INTO ${table}(id,institution_id,${cols.join(',')}) VALUES(?,?,${cols.map(()=>'?').join(',')})`).run(rid,instId,...vals);audit(u,'CREATE',table,rid,b);return json(res,201,{id:rid});}
     if(method==='PUT'&&p.startsWith(`/api/${table}/`)){if(!['coordinator','owner'].includes(u.role))return deny(res);const rid=p.split('/').pop(),row=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(rid);if(!row)return json(res,404,{error:'العنصر غير موجود'});if(u.role==='coordinator'&&row.institution_id!==u.institution_id)return deny(res);const b=await body(req);const vals=cols.map(k=>b[k]??row[k]);db.prepare(`UPDATE ${table} SET ${cols.map(k=>k+'=?').join(',')} WHERE id=?`).run(...vals,rid);audit(u,'UPDATE',table,rid,b);return json(res,200,{ok:true});}
     if(method==='DELETE'&&p.startsWith(`/api/${table}/`)){if(!['coordinator','owner'].includes(u.role))return deny(res);const rid=p.split('/').pop(),row=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(rid);if(!row)return json(res,404,{error:'العنصر غير موجود'});if(u.role==='coordinator'&&row.institution_id!==u.institution_id)return deny(res);db.prepare(`DELETE FROM ${table} WHERE id=?`).run(rid);audit(u,'DELETE',table,rid,{});return json(res,200,{ok:true});}
   }
 }
 if(p==='/api/message-targets'&&method==='GET'){
   const owner=db.prepare("SELECT id,full_name,'owner' role FROM users WHERE role='owner' AND active=1 LIMIT 1").all();
   let rows=[];
   if(u.role==='coordinator')rows=db.prepare("SELECT id,full_name,role FROM users WHERE institution_id=? AND role='teacher' AND active=1 ORDER BY full_name").all(u.institution_id);
   else if(u.role==='inspector'){const ids=institutionScope(u).map(i=>i.id);if(ids.length){const ph=ids.map(()=>'?').join(',');rows=db.prepare(`SELECT id,full_name,role FROM users WHERE institution_id IN (${ph}) AND role IN ('coordinator','teacher') AND active=1 ORDER BY role,full_name`).all(...ids)}}
   return json(res,200,[...owner,...rows]);
 }
 if(p==='/api/institutions'&&method==='GET') return json(res,200,institutionScope(u));
 if(p==='/api/institutions'&&method==='POST'){if(u.role!=='owner')return deny(res,'خاص بمالك المنصة');const b=await body(req);if(!b.name)return json(res,400,{error:'اسم المؤسسة مطلوب'});const iid=id();try{db.prepare('INSERT INTO institutions(id,name,code,directorate,region,subscription_status) VALUES(?,?,?,?,?,?)').run(iid,b.name,b.code||null,b.directorate||null,b.region||null,'pending');audit(u,'CREATE','institution',iid,b);return json(res,201,{id:iid})}catch(e){return json(res,409,{error:'رمز المؤسسة موجود مسبقاً'})}}
 // Teachers
 if(p==='/api/owner/accounts'&&method==='GET'){if(u.role!=='owner')return deny(res);return json(res,200,db.prepare(`SELECT u.id,u.username,u.role,u.full_name,u.email,u.phone,u.institution_id,u.active,i.name institution_name,(SELECT MAX(s.ends_on) FROM subscriptions s WHERE s.institution_id=u.institution_id AND s.status='active') subscription_end FROM users u LEFT JOIN institutions i ON i.id=u.institution_id WHERE u.role!='owner' ORDER BY CASE u.role WHEN 'coordinator' THEN 1 WHEN 'inspector' THEN 2 ELSE 3 END,u.full_name`).all())}
if(p==='/api/owner/accounts'&&method==='POST'){if(u.role!=='owner')return deny(res);const b=await body(req);if(!b.full_name||!b.username||!['teacher','coordinator','inspector'].includes(b.role))return json(res,400,{error:'المعطيات الأساسية ناقصة'});if(db.prepare('SELECT id FROM users WHERE username=?').get(b.username))return json(res,409,{error:'اسم المستخدم موجود مسبقاً'});if(b.institution_id&&!db.prepare('SELECT id FROM institutions WHERE id=?').get(b.institution_id))return json(res,404,{error:'المؤسسة غير موجودة'});const uid=id(),temp=b.password||crypto.randomBytes(8).toString('base64url');db.prepare('INSERT INTO users(id,username,password_hash,role,full_name,email,phone,institution_id,active,force_password_change,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(uid,b.username,hash(temp),b.role,b.full_name,b.email||null,b.phone||null,b.institution_id||null,1,1,new Date().toISOString());audit(u,'CREATE','user',uid,{role:b.role,institution_id:b.institution_id||null});return json(res,201,{id:uid,username:b.username,temp_password:temp})}
if(p.startsWith('/api/owner/accounts/')&&method==='PATCH'){if(u.role!=='owner')return deny(res);const uid=p.split('/').pop(),b=await body(req),x=db.prepare('SELECT * FROM users WHERE id=?').get(uid);if(!x)return json(res,404,{error:'الحساب غير موجود'});if(x.role==='owner')return deny(res,'لا يمكن تعطيل مالك المنصة من هنا');db.prepare('UPDATE users SET active=? WHERE id=?').run(b.active?1:0,uid);audit(u,b.active?'ACTIVATE':'DEACTIVATE','user',uid,{});return json(res,200,{ok:true})}
if(p.startsWith('/api/owner/accounts/')&&method==='DELETE'){if(u.role!=='owner')return deny(res);const uid=p.split('/').pop(),x=db.prepare('SELECT * FROM users WHERE id=?').get(uid);if(!x)return json(res,404,{error:'الحساب غير موجود'});if(x.role==='owner')return deny(res,'لا يمكن حذف مالك المنصة');try{hardDeleteUserAccount(uid)}catch(err){return json(res,500,{error:'تعذر حذف الحساب',detail:err.message})}audit(u,'DELETE','user',uid,{role:x.role,institution_id:x.institution_id,hard_delete:true});return json(res,200,{ok:true,deleted:true})}
if(p==='/api/owner/overview'&&method==='GET'){if(u.role!=='owner')return deny(res);
  const institutions=db.prepare('SELECT COUNT(*) c FROM institutions').get().c;
  const teachers=db.prepare("SELECT COUNT(*) c FROM users WHERE role='teacher' AND active=1").get().c;
  const coordinators=db.prepare("SELECT COUNT(*) c FROM users WHERE role='coordinator' AND active=1").get().c;
  const inspectors=db.prepare("SELECT COUNT(*) c FROM users WHERE role='inspector' AND active=1").get().c;
  const subscriptions=db.prepare("SELECT COUNT(*) c FROM subscriptions WHERE status='active'").get().c;
  const pendingSubscriptions=db.prepare("SELECT COUNT(*) c FROM subscriptions WHERE status!='active'").get().c;
  const activeUsers=db.prepare('SELECT COUNT(*) c FROM users WHERE active=1').get().c;
  const reports=db.prepare('SELECT COUNT(*) c FROM reports').get().c;
  const now=new Date(); const iso=t=>new Date(t).toISOString().slice(0,10);
  const today=iso(now); const soon=iso(new Date(now.getTime()+30*86400000));
  const expiring=db.prepare(`SELECT s.id,s.ends_on,s.status,i.name institution_name FROM subscriptions s JOIN institutions i ON i.id=s.institution_id WHERE s.status='active' AND s.ends_on>=? AND s.ends_on<=? ORDER BY s.ends_on ASC LIMIT 8`).all(today,soon);
  const errors=db.prepare(`SELECT a.created_at,a.action,a.entity,a.details,u.full_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE lower(a.action) LIKE '%error%' OR lower(a.action) LIKE '%fail%' OR lower(a.details) LIKE '%error%' OR lower(a.details) LIKE '%échec%' ORDER BY a.created_at DESC LIMIT 8`).all();
  const errorCount=db.prepare(`SELECT COUNT(*) c FROM audit_log a WHERE lower(a.action) LIKE '%error%' OR lower(a.action) LIKE '%fail%' OR lower(a.details) LIKE '%error%' OR lower(a.details) LIKE '%échec%'`).get().c;
  const recent=db.prepare(`SELECT a.created_at,a.action,a.entity,a.details,u.full_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 8`).all();
  const instRows=db.prepare(`SELECT i.id,i.name,i.code,i.subscription_status,COUNT(DISTINCT t.id) teachers,COUNT(DISTINCT c.id) classes,COALESCE((SELECT MAX(s.ends_on) FROM subscriptions s WHERE s.institution_id=i.id AND s.status='active'),'—') subscription_end FROM institutions i LEFT JOIN users t ON t.institution_id=i.id AND t.role='teacher' LEFT JOIN classes c ON c.institution_id=i.id GROUP BY i.id ORDER BY i.created_at DESC`).all();
  const health=errorCount===0?'stable':errorCount<5?'watch':'attention';
  const risk=errorCount>=5?'high':errorCount>=2?'medium':'low';
  const predictions=[
    ...(errorCount>=2?[{level:risk,title:'ارتفاع محتمل في الأخطاء التقنية',reason:`تم تسجيل ${errorCount} مؤشراً تقنياً يحتاج إلى المراقبة.`,action:'مراجعة سجل التدقيق والخدمات التي سجلت أخطاء متكررة.'}]:[]),
    ...(expiring.length?[{level:'medium',title:'اشتراكات تقترب من الانتهاء',reason:`هناك ${expiring.length} اشتراكاً خلال 30 يوماً القادمة.`,action:'إرسال تذكيرات ومتابعة التجديد قبل تاريخ الانتهاء.'}]:[]),
    ...(errorCount===0&&expiring.length===0?[{level:'low',title:'لا توجد مؤشرات خطر بارزة حالياً',reason:'المؤشرات المسجلة لا تظهر نمطاً واضحاً لعطل قريب.',action:'الاستمرار في المراقبة الدورية.'}]:[])
  ];
  return json(res,200,{institutions,teachers,coordinators,inspectors,subscriptions,pendingSubscriptions,activeUsers,reports,recent,institutionRows:instRows,expiring,errors,health,errorCount,predictions});
}
if(p==='/api/subscriptions'&&method==='GET'){if(u.role!=='owner')return deny(res);return json(res,200,db.prepare(`SELECT s.*,i.name institution_name FROM subscriptions s JOIN institutions i ON i.id=s.institution_id ORDER BY s.created_at DESC`).all())}
if(p==='/api/subscriptions'&&method==='POST'){if(u.role!=='owner')return deny(res);const b=await body(req);const inst=db.prepare('SELECT * FROM institutions WHERE id=?').get(b.institution_id);if(!inst)return json(res,404,{error:'المؤسسة غير موجودة'});const sid=id(),amount=Number(b.amount||0);db.prepare(`INSERT INTO subscriptions(id,institution_id,plan,starts_on,ends_on,status,created_at,amount,paid_amount,payment_status) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(sid,inst.id,b.plan||'Institution Pro',b.starts_on||new Date().toISOString().slice(0,10),b.ends_on||'2027-09-01',b.status||'active',new Date().toISOString(),amount,Number(b.paid_amount||0),b.payment_status||'paid');db.prepare('UPDATE institutions SET subscription_status=? WHERE id=?').run(b.status||'active',inst.id);audit(u,'CREATE','subscription',sid,b);return json(res,201,{id:sid})}
if(p==='/api/platform-expenses'&&method==='GET'){if(u.role!=='owner')return deny(res);return json(res,200,db.prepare('SELECT e.*,u.full_name creator_name FROM platform_expenses e LEFT JOIN users u ON u.id=e.created_by ORDER BY e.expense_date DESC,e.created_at DESC').all())}
if(p==='/api/platform-expenses'&&method==='POST'){if(u.role!=='owner')return deny(res);const b=await body(req);const eid=id();db.prepare('INSERT INTO platform_expenses(id,label,category,amount,expense_date,notes,created_by,reference) VALUES(?,?,?,?,?,?,?,?)').run(eid,b.label||'مصروف',b.category||'عام',Number(b.amount||0),b.expense_date||new Date().toISOString().slice(0,10),b.notes||null,u.id,b.reference||null);audit(u,'CREATE','platform_expense',eid,b);return json(res,201,{id:eid})}
 if(p==='/api/teachers'&&method==='GET'){let rows;if(u.role==='owner')rows=db.prepare("SELECT id,username,role,full_name,email,phone,institution_id,active FROM users WHERE role='teacher' ORDER BY full_name").all();else if(u.role==='inspector')rows=db.prepare("SELECT id,username,role,full_name,email,phone,institution_id,active FROM users WHERE role='teacher' AND institution_id IN (SELECT institution_id FROM inspector_institutions WHERE inspector_id=? AND status='active') ORDER BY full_name").all(u.id);else if(u.role==='coordinator')rows=db.prepare("SELECT id,username,role,full_name,email,phone,institution_id,active FROM users WHERE role='teacher' AND institution_id=? ORDER BY full_name").all(u.institution_id);else rows=[{id:u.id,username:u.username,role:u.role,full_name:u.full_name,email:u.email,phone:u.phone,institution_id:u.institution_id,active:u.active}];return json(res,200,rows)}
 if(p.startsWith('/api/teachers/')&&method==='PUT'){
  if(!['coordinator','owner'].includes(u.role))return deny(res,'غير مسموح بتعديل الأستاذ');
  const tid=p.split('/').pop(),t=db.prepare("SELECT * FROM users WHERE id=? AND role='teacher'").get(tid);
  if(!t)return json(res,404,{error:'الأستاذ غير موجود'});
  if(u.role==='coordinator'&&t.institution_id!==u.institution_id)return deny(res,'هذا الأستاذ لا ينتمي إلى مؤسستك');
  const b=await body(req),name=String(b.full_name??t.full_name).trim(); if(!name)return json(res,400,{error:'اسم الأستاذ مطلوب'});
  db.prepare('UPDATE users SET full_name=?,email=?,phone=?,active=? WHERE id=?').run(name,b.email??t.email,b.phone??t.phone,b.active===undefined?t.active:(String(b.active)==='1'?1:0),tid);
  audit(u,'UPDATE','teacher',tid,b); return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/teachers/')&&method==='DELETE'){
  if(!['coordinator','owner'].includes(u.role))return deny(res,'غير مسموح بحذف الأستاذ');
  const tid=p.split('/').pop(),t=db.prepare("SELECT * FROM users WHERE id=? AND role='teacher'").get(tid);
  if(!t)return json(res,404,{error:'الأستاذ غير موجود'});
  if(u.role==='coordinator'&&t.institution_id!==u.institution_id)return deny(res,'هذا الأستاذ لا ينتمي إلى مؤسستك');
  try{hardDeleteUserAccount(tid)}catch(err){return json(res,500,{error:'تعذر حذف الأستاذ',detail:err.message})}
  audit(u,'DELETE','teacher',tid,{institution_id:t.institution_id,hard_delete:true}); return json(res,200,{ok:true,deleted:true});
 }
 if(p==='/api/teachers'&&method==='POST'){if(u.role!=='coordinator'&&u.role!=='owner')return deny(res,'غير مسموح بإضافة الأساتذة');const b=await body(req),tid=b.teacher_id;const t=tid?db.prepare("SELECT * FROM users WHERE id=? AND role='teacher'").get(tid):null;if(t){if(u.role==='coordinator'&&t.institution_id!==u.institution_id)return deny(res,'هذا الأستاذ تابع لمؤسسة أخرى ولا يمكن إضافته إلى اشتراك مؤسستك');return json(res,400,{error:'الأستاذ مرتبط بالفعل بمؤسسة'})}if(u.role==='coordinator'&&b.institution_id&&b.institution_id!==u.institution_id)return deny(res,'ممنوع تحديد مؤسسة أخرى');const inst=u.role==='owner'?b.institution_id:u.institution_id;if(!inst)return json(res,400,{error:'المؤسسة مطلوبة'});const nid=id(),username=b.username||('teacher'+Math.floor(Math.random()*100000));const temp=b.password||crypto.randomBytes(8).toString('base64url');db.prepare('INSERT INTO users(id,username,password_hash,role,full_name,email,phone,institution_id,active,force_password_change,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(nid,username,hash(temp),'teacher',b.full_name||'أستاذ جديد',b.email||null,b.phone||null,b.institution_id||inst,1,1,new Date().toISOString());audit(u,'CREATE','teacher',nid,{institution_id:inst});return json(res,201,{id:nid,username,temp_password:temp})}
 // classes
 if(p==='/api/classes'&&method==='GET'){
 let rows;
 if(u.role==='owner') rows=db.prepare(`SELECT c.*,i.name institution_name,u.full_name teacher_name,'owner' source FROM classes c LEFT JOIN institutions i ON i.id=c.institution_id LEFT JOIN users u ON u.id=c.teacher_id ORDER BY c.name`).all();
 else if(u.role==='inspector') rows=db.prepare(`SELECT c.*,i.name institution_name,u.full_name teacher_name,'institution' source FROM classes c LEFT JOIN institutions i ON i.id=c.institution_id LEFT JOIN users u ON u.id=c.teacher_id WHERE c.institution_id IN (SELECT institution_id FROM inspector_institutions WHERE inspector_id=?) ORDER BY c.name`).all(u.id);
 else if(u.role==='teacher') rows=db.prepare(`SELECT c.*,i.name institution_name,u.full_name teacher_name,CASE WHEN c.teacher_id=? THEN 'assigned' ELSE 'timetable' END source FROM classes c LEFT JOIN institutions i ON i.id=c.institution_id LEFT JOIN users u ON u.id=c.teacher_id WHERE c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?)) ORDER BY c.name`).all(u.id,u.institution_id,u.id,u.id);
 else rows=db.prepare(`SELECT c.*,i.name institution_name,u.full_name teacher_name,'institution' source FROM classes c LEFT JOIN institutions i ON i.id=c.institution_id LEFT JOIN users u ON u.id=c.teacher_id WHERE c.institution_id=? ORDER BY c.name`).all(u.institution_id); return json(res,200,rows)}
 if(p==='/api/classes'&&method==='POST'){if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);const b=await body(req),inst=u.role==='owner'?b.institution_id:u.institution_id;if(!inst||!sameInst(u,inst))return deny(res,'المؤسسة غير مسموح بها');if(b.teacher_id){const t=db.prepare('SELECT * FROM users WHERE id=? AND role=\'teacher\'').get(b.teacher_id);if(!t||t.institution_id!==inst)return deny(res,'يجب أن يكون الأستاذ من المؤسسة نفسها')}const cid=id(),teacherId=u.role==='teacher'?u.id:(b.teacher_id||null);db.prepare('INSERT INTO classes VALUES(?,?,?,?,?,?,?)').run(cid,inst,b.name,b.level||null,b.year_label||null,teacherId,1);audit(u,'CREATE','class',cid,{...b,teacher_id:teacherId});return json(res,201,{id:cid})}
 // students
 if(p==='/api/students'&&method==='GET'){const cls=url.searchParams.get('class_id');let rows=[];if(u.role==='teacher'){rows=db.prepare(`SELECT s.*,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?)) ${cls?'AND c.id=?':''} ORDER BY s.last_name,s.first_name,s.id`).all(...(cls?[u.institution_id,u.id,u.id,cls]:[u.institution_id,u.id,u.id]));}else if(u.role==='coordinator'){rows=db.prepare(`SELECT s.*,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE c.institution_id=? ${cls?'AND c.id=?':''} ORDER BY s.last_name,s.first_name`).all(...(cls?[u.institution_id,cls]:[u.institution_id]));}else if(u.role==='owner'){rows=db.prepare('SELECT s.*,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id ORDER BY s.last_name,s.first_name').all();}else return deny(res,'المفتش لا يطلع على المعطيات الفردية للتلاميذ');return json(res,200,rows)}
 if(p==='/api/students/inspect-file'&&method==='POST'){
  if(u.role!=='teacher')return deny(res); const b=await body(req),c=b.class_id&&b.class_id!=='NEW'?db.prepare('SELECT * FROM classes WHERE id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable WHERE class_id=classes.id AND teacher_id=?))').get(b.class_id,u.id,u.id):null; if(b.class_id&&b.class_id!=='NEW'&&!c)return deny(res);
  const filename=String(b.filename||'').toLowerCase(); if(!filename.endsWith('.xlsx')&&!filename.endsWith('.csv'))return json(res,400,{error:'الملف يجب أن يكون Excel .xlsx أو CSV'});
  const buf=Buffer.from(String(b.data||'').replace(/^data:.*?;base64,/,'').replace(/\s/g,''),'base64'); try{if(filename.endsWith('.csv')){const rows=parseCsvBuffer(buf);return json(res,200,{sheets:[{name:'CSV',rows:rows.slice(0,20),normalized_preview:normalizeStudentRows(rows).slice(0,20)}]});} const parsed=parseXlsxWithPython(buf);return json(res,200,{sheets:parsed.sheets.map(x=>({name:x.name,rows:x.rows.slice(0,20),normalized_preview:normalizeStudentRows(x.rows).slice(0,20)}))});}catch(e){return json(res,400,{error:e.message||'تعذر قراءة ملف Excel'});}
 }
 if(p==='/api/students/import-file'&&method==='POST'){
 if(u.role!=='teacher')return deny(res); const b=await body(req),c=db.prepare('SELECT * FROM classes WHERE id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))').get(b.class_id,u.id,u.id); if(!c)return deny(res);
 const filename=String(b.filename||'').toLowerCase(); if(!filename.endsWith('.xlsx')&&!filename.endsWith('.csv'))return json(res,400,{error:'الملف يجب أن يكون Excel .xlsx أو CSV'}); if(!b.data)return json(res,400,{error:'الملف فارغ'});
 let rows; try{const buf=Buffer.from(String(b.data).replace(/^data:.*?;base64,/,'').replace(/\s/g,''),'base64'); if(filename.endsWith('.csv')){const text=buf.toString('utf8').replace(/^\ufeff/,''); rows=text.split(/\r?\n/).filter(Boolean).map(line=>line.split(/\t|;|,/).map(x=>x.trim()));}else {const parsed=parseXlsxWithPython(buf); const requestedSheet=String(b.sheet||''); rows=(requestedSheet&&parsed.sheets.find(x=>x.name===requestedSheet)?.rows)||parsed.rows;}}catch(e){return json(res,400,{error:e.message||'تعذر قراءة الملف'});}
 const normalized=normalizeStudentRows(rows); if(!normalized.length)return json(res,400,{error:'لم يتم العثور على تلاميذ في الملف'}); const existing=db.prepare('SELECT id,massar_number FROM students WHERE class_id=?').all(c.id);let added=0,updated=0,invalid=0;
 for(const r of normalized){const massar=r.massar_number,first=r.first_name,last=r.last_name;if(!massar||(!first&&!last)){invalid++;continue}const old=db.prepare('SELECT * FROM students WHERE massar_number=?').get(massar);if(old){if(old.class_id!==c.id){db.prepare('UPDATE students SET class_id=?,first_name=?,last_name=?,dob=?,gender=?,birth_place=? WHERE id=?').run(c.id,first||old.first_name,last||old.last_name,r.dob||old.dob,r.gender||old.gender,r.birth_place||old.birth_place,old.id);updated++;}else{db.prepare('UPDATE students SET first_name=?,last_name=?,dob=?,gender=?,birth_place=? WHERE id=?').run(first||old.first_name,last||old.last_name,r.dob||old.dob,r.gender||old.gender,r.birth_place||old.birth_place,old.id);updated++;}}else{db.prepare('INSERT INTO students(id,class_id,massar_number,first_name,last_name,dob,gender,birth_place,photo_path,health_note,eps_note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id(),c.id,massar,first,last,r.dob||null,r.gender||null,r.birth_place||null,null,null,null,new Date().toISOString());added++;}}
 const imported=new Set(normalized.map(r=>r.massar_number)); const missing=existing.filter(x=>!imported.has(x.massar_number)).map(x=>x.massar_number); audit(u,'IMPORT_FILE','students',c.id,{filename,added,updated,invalid,missing:missing.length}); return json(res,200,{added,updated,invalid,missing,filename});
}
if(p==='/api/students/import'&&method==='POST'){if(u.role!=='teacher')return deny(res);const b=await body(req),classId=b.class_id,rows=Array.isArray(b.rows)?b.rows:[],c=db.prepare('SELECT * FROM classes WHERE id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))').get(classId,u.id,u.id);if(!c)return deny(res);if(!rows.length)return json(res,400,{error:'Aucune ligne à importer'});const existing=db.prepare('SELECT id,massar_number FROM students WHERE class_id=?').all(classId);const existingSet=new Set(existing.map(x=>x.massar_number));let added=0,updated=0,invalid=0;for(const r of rows){const massar=String(r.massar_number||r.massar||'').trim();const first=String(r.first_name||r.prenom||r.prénom||'').trim();const last=String(r.last_name||r.nom||'').trim();if(!massar||(!first&&!last)){invalid++;continue}const old=db.prepare('SELECT * FROM students WHERE massar_number=?').get(massar);if(old){if(old.class_id!==c.id){db.prepare('UPDATE students SET class_id=?,first_name=?,last_name=? WHERE id=?').run(c.id,first||old.first_name,last||old.last_name,old.id);updated++;}else{db.prepare('UPDATE students SET first_name=?,last_name=? WHERE id=?').run(first||old.first_name,last||old.last_name,old.id);updated++;}}else{db.prepare('INSERT INTO students(id,class_id,massar_number,first_name,last_name,dob,gender,photo_path,health_note,eps_note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id(),c.id,massar,first,last,r.dob||null,r.gender||null,null,null,null,new Date().toISOString());added++;}}const imported=new Set(rows.map(r=>String(r.massar_number||r.massar||'').trim()).filter(Boolean));const missing=existing.filter(x=>!imported.has(x.massar_number)).map(x=>x.massar_number);audit(u,'IMPORT','students',c.id,{added,updated,invalid,missing:missing.length});return json(res,200,{added,updated,invalid,missing})}
if(p==='/api/students'&&method==='POST'){if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);const b=await body(req),c=db.prepare('SELECT * FROM classes WHERE id=?').get(b.class_id);if(!accessibleClass(u,c)|| (u.role==='teacher'&&c.teacher_id!==u.id&&!db.prepare('SELECT 1 FROM timetable WHERE class_id=? AND teacher_id=?').get(c.id,u.id)))return deny(res);if(db.prepare('SELECT id FROM students WHERE massar_number=?').get(b.massar_number))return json(res,409,{error:'رقم مسار موجود مسبقاً'});const sid=id();db.prepare('INSERT INTO students(id,class_id,massar_number,first_name,last_name,dob,gender,birth_place,photo_path,health_note,eps_note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(sid,c.id,b.massar_number,b.first_name||'',b.last_name||'',b.dob||null,b.gender||null,b.birth_place||null,b.photo_path||null,b.health_note||null,b.eps_note||null,new Date().toISOString());audit(u,'CREATE','student',sid,{class_id:c.id});return json(res,201,{id:sid})}
 // planning/units/sessions
 // Atomic annual-plan save: the coordinator's plan, teacher assignment and all units are persisted together.
 // This prevents the live no-refresh renderer from interrupting a multi-request form submission.
 if(p==='/api/plans/complete'&&method==='POST'&&['coordinator','owner'].includes(u.role)){
   const b=await body(req),inst=u.role==='owner'?String(b.institution_id||'').trim():u.institution_id;
   if(!inst||!sameInst(u,inst))return deny(res,'المؤسسة غير مسموح بها');
   const teacherId=String(b.teacher_id||'').trim();
   if(!teacherId)return json(res,400,{error:'يجب إسناد التخطيط إلى أستاذ'});
   const teacher=db.prepare("SELECT id,full_name,institution_id,role,active FROM users WHERE id=? AND role='teacher'").get(teacherId);
   if(!teacher||teacher.institution_id!==inst)return json(res,400,{error:'الأستاذ المحدد غير تابع للمؤسسة نفسها'});
   const rawUnits=Array.isArray(b.units)?b.units:[];
   const units=rawUnits.map((x,i)=>({
     sport:String(x.sport||'').trim(),title:String(x.title||x.sport||'').trim(),class_id:String(x.class_id||'').trim(),
     session_count:Number(x.session_count||10),duration_minutes:Number(x.duration_minutes||60),objective:x.objective?String(x.objective):null,
     cycle:Number(x.cycle||1),start_date:x.start_date?String(x.start_date):null,end_date:x.end_date?String(x.end_date):null
   })).filter(x=>x.sport&&x.class_id);
   if(!units.length)return json(res,400,{error:'يجب إدخال نشاط واحد على الأقل مع اختيار القسم'});
   for(const x of units){
     if(![1,2].includes(x.cycle))return json(res,400,{error:'الدورة يجب أن تكون 1 أو 2'});
     if(![10,12].includes(x.session_count))return json(res,400,{error:'عدد الحصص يجب أن يكون 10 أو 12'});
     if(x.duration_minutes<1||x.duration_minutes>300)return json(res,400,{error:'مدة الحصة غير صحيحة'});
     const cls=db.prepare('SELECT id,institution_id FROM classes WHERE id=?').get(x.class_id);
     if(!cls||cls.institution_id!==inst)return json(res,400,{error:'يوجد قسم غير تابع للمؤسسة'});
     if(x.start_date&&x.end_date&&x.start_date>x.end_date)return json(res,400,{error:'تاريخ بداية النشاط يجب أن يسبق تاريخ نهايته'});
   }
   const planId=String(b.plan_id||'').trim()||id();
   const title=String(b.title||'التخطيط السنوي للتربية البدنية').trim();
   const schoolYear=String(b.school_year||'2026-2027').trim();
   try{
     db.exec('BEGIN');
     const existing=db.prepare('SELECT * FROM annual_plans WHERE id=?').get(planId);
     if(existing){
       if(existing.institution_id!==inst)throw new Error('الخطة غير تابعة للمؤسسة');
       db.prepare('UPDATE annual_plans SET teacher_id=?,title=?,school_year=?,status=? WHERE id=?').run(teacherId,title,schoolYear,String(b.status||'active'),planId);
       db.prepare('DELETE FROM units WHERE plan_id=?').run(planId);
     }else{
       db.prepare('INSERT INTO annual_plans(id,institution_id,teacher_id,title,school_year,status,created_at) VALUES(?,?,?,?,?,?,?)').run(planId,inst,teacherId,title,schoolYear,String(b.status||'active'),new Date().toISOString());
     }
     for(const x of units){
       const uid=id();
       db.prepare('INSERT INTO units(id,plan_id,class_id,sport,title,session_count,duration_minutes,objective,created_at,cycle,start_date,end_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(uid,planId,x.class_id,x.sport,x.title,x.session_count,x.duration_minutes,x.objective,new Date().toISOString(),x.cycle,x.start_date,x.end_date);
     }
     db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),teacherId,'تم إسناد التخطيط السنوي إليك',`تم إسناد «${title}» إليك من طرف المؤسسة. يمكنك الآن استعماله في الوحدات والحصص والجذاذات والتقويم.`,'annual_plan_assigned',null,new Date().toISOString(),planId);
     db.exec('COMMIT');
     audit(u,existing?'UPDATE':'CREATE','annual_plan',planId,{teacher_id:teacherId,institution_id:inst,units:units.length,assigned:true,atomic:true});
     return json(res,200,{ok:true,id:planId,assigned:true,teacher_id:teacherId,teacher_name:teacher.full_name,units:units.length});
   }catch(e){try{db.exec('ROLLBACK')}catch{};return json(res,400,{error:e.message||'تعذر حفظ التخطيط السنوي'});}
 }
 if(p==='/api/plans/save'&&method==='POST'){
   if(!['coordinator','owner'].includes(u.role))return deny(res,'غير مسموح بإدارة التخطيط السنوي');
   const b=await body(req);
   const inst=u.role==='owner'?String(b.institution_id||'').trim():u.institution_id;
   const teacherId=String(b.teacher_id||'').trim();
   const title=String(b.title||'التخطيط السنوي للتربية البدنية').trim();
   const schoolYear=String(b.school_year||'2026-2027').trim();
   const units=Array.isArray(b.units)?b.units:[];
   if(!inst||!sameInst(u,inst))return deny(res,'المؤسسة غير مسموح بها');
   if(!teacherId)return json(res,400,{error:'يجب اختيار الأستاذ قبل حفظ التخطيط'});
   const teacher=db.prepare("SELECT id,full_name,institution_id,role,active FROM users WHERE id=? AND role='teacher'").get(teacherId);
   if(!teacher||teacher.institution_id!==inst)return json(res,400,{error:'الأستاذ المحدد غير تابع للمؤسسة نفسها'});
   const clean=[];
   for(const raw of units){
     const sport=String(raw.sport||'').trim(); const classId=String(raw.class_id||'').trim();
     if(!sport||!classId)continue;
     const cls=db.prepare('SELECT id,institution_id,name FROM classes WHERE id=?').get(classId);
     if(!cls||cls.institution_id!==inst)return json(res,400,{error:'أحد الأقسام المحددة غير تابع للمؤسسة نفسها'});
     const cycle=Math.max(1,Math.min(3,Number(raw.cycle||1)));
     const count=[10,12].includes(Number(raw.session_count))?Number(raw.session_count):10;
     const duration=Math.max(1,Number(raw.duration_minutes||60));
     clean.push({sport,class_id:classId,title:sport,session_count:count,duration_minutes:duration,objective:raw.objective||null,cycle,start_date:raw.start_date||null,end_date:raw.end_date||null});
   }
   if(!clean.length)return json(res,400,{error:'أدخل نشاطاً واحداً على الأقل مع القسم والأستاذ'});
   const planId=String(b.plan_id||'').trim();
   try{
     db.exec('BEGIN');
     let pid=planId;
     if(pid){
       const existing=db.prepare('SELECT * FROM annual_plans WHERE id=?').get(pid);
       if(!existing)throw new Error('الخطة غير موجودة');
       if(existing.institution_id!==inst)throw new Error('الخطة لا تنتمي إلى المؤسسة');
       db.prepare('UPDATE annual_plans SET title=?,school_year=?,status=?,teacher_id=? WHERE id=?').run(title,schoolYear,'active',teacherId,pid);
       db.prepare('DELETE FROM units WHERE plan_id=?').run(pid);
     }else{
       pid=id();
       db.prepare('INSERT INTO annual_plans(id,institution_id,teacher_id,title,school_year,status,created_at) VALUES(?,?,?,?,?,?,?)').run(pid,inst,teacherId,title,schoolYear,'active',new Date().toISOString());
     }
     for(const q of clean){
       const uid=id();
       db.prepare('INSERT INTO units(id,plan_id,class_id,sport,title,session_count,duration_minutes,objective,created_at,cycle,start_date,end_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(uid,pid,q.class_id,q.sport,q.title,q.session_count,q.duration_minutes,q.objective,new Date().toISOString(),q.cycle,q.start_date,q.end_date);
     }
     db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),teacherId,'تم إسناد التخطيط السنوي إليك',`تم إسناد «${title}» إليك. التخطيط والأنشطة أصبحت متاحة الآن في حسابك.`,'annual_plan_assigned',null,new Date().toISOString(),pid);
     audit(u,planId?'UPDATE':'CREATE','annual_plan',pid,{title,school_year,teacher_id:teacherId,institution_id:inst,units:clean.length,atomic:true});
     db.exec('COMMIT');
     return json(res,200,{ok:true,id:pid,assigned:true,teacher_id:teacherId,teacher_name:teacher.full_name,units_count:clean.length});
   }catch(e){try{db.exec('ROLLBACK')}catch{};return json(res,400,{error:e.message||'تعذر حفظ التخطيط السنوي'});}
 }
 if(p==='/api/plans'&&method==='GET'){
   let rows;
   if(u.role==='owner') rows=db.prepare('SELECT p.*,i.name institution_name,u.full_name teacher_name FROM annual_plans p LEFT JOIN institutions i ON i.id=p.institution_id LEFT JOIN users u ON u.id=p.teacher_id ORDER BY p.created_at DESC').all();
   else if(u.role==='inspector') rows=db.prepare('SELECT p.*,i.name institution_name,u.full_name teacher_name FROM annual_plans p LEFT JOIN institutions i ON i.id=p.institution_id LEFT JOIN users u ON u.id=p.teacher_id WHERE p.institution_id IN (SELECT institution_id FROM inspector_institutions WHERE inspector_id=?) ORDER BY p.created_at DESC').all(u.id);
   else if(u.role==='teacher') rows=db.prepare('SELECT p.*,i.name institution_name,u.full_name teacher_name FROM annual_plans p LEFT JOIN institutions i ON i.id=p.institution_id LEFT JOIN users u ON u.id=p.teacher_id WHERE p.institution_id=? AND p.teacher_id=? ORDER BY p.created_at DESC').all(u.institution_id,u.id);
   else rows=db.prepare('SELECT p.*,i.name institution_name,u.full_name teacher_name FROM annual_plans p LEFT JOIN institutions i ON i.id=p.institution_id LEFT JOIN users u ON u.id=p.teacher_id WHERE p.institution_id=?').all(u.institution_id);
   return json(res,200,rows)
 }
 if(p==='/api/plans'&&method==='POST'){
   if(!['coordinator','owner'].includes(u.role))return deny(res);
   const b=await body(req),inst=u.role==='owner'?b.institution_id:u.institution_id;
   if(!inst||!sameInst(u,inst))return deny(res);
   const teacherId=String(b.teacher_id||'').trim();
   if(!teacherId)return json(res,400,{error:'يجب إسناد التخطيط إلى أستاذ'});
   const teacher=db.prepare("SELECT id,full_name,institution_id,role,active FROM users WHERE id=? AND role='teacher'").get(teacherId);
   if(!teacher||teacher.institution_id!==inst)return json(res,400,{error:'الأستاذ المحدد غير تابع للمؤسسة نفسها'});
   const pid=id();
   db.prepare('INSERT INTO annual_plans(id,institution_id,teacher_id,title,school_year,status,created_at) VALUES(?,?,?,?,?,?,?)').run(pid,inst,teacherId,String(b.title||'التخطيط السنوي للتربية البدنية'),b.school_year||'2026-2027',b.status||'active',new Date().toISOString());
   db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),teacherId,'تخطيط سنوي جديد',`تم إسناد التخطيط السنوي «${String(b.title||'التخطيط السنوي للتربية البدنية')}» إليك. يمكنك الآن استعماله لإعداد الوحدات والحصص والجذاذات والتقويم. `,'annual_plan_assigned',null,new Date().toISOString(),pid);
   audit(u,'CREATE','annual_plan',pid,{...b,teacher_id:teacherId,institution_id:inst,assigned:true});
   return json(res,201,{id:pid,assigned:true,teacher_id:teacherId,teacher_name:teacher.full_name})
 }
 if(p==='/api/units'&&method==='GET'){
   if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);
   const scope=u.role==='owner'?'1=1':u.role==='teacher'?'p.institution_id=? AND p.teacher_id=?':'p.institution_id=?';
   const args=u.role==='owner'?[]:u.role==='teacher'?[u.institution_id,u.id]:[u.institution_id];
   return json(res,200,db.prepare(`SELECT un.*,p.title plan_title,p.teacher_id,c.name class_name FROM units un JOIN annual_plans p ON p.id=un.plan_id JOIN classes c ON c.id=un.class_id WHERE ${scope} ORDER BY un.cycle,un.start_date,un.created_at`).all(...args))
 }
 if(p==='/api/units'&&method==='POST'){if(!['coordinator','owner'].includes(u.role))return deny(res);const b=await body(req),p0=db.prepare('SELECT * FROM annual_plans WHERE id=?').get(b.plan_id),c=db.prepare('SELECT * FROM classes WHERE id=?').get(b.class_id);if(!p0||!c||!sameInst(u,p0.institution_id)||p0.institution_id!==c.institution_id)return deny(res);const uid=id();db.prepare('INSERT INTO units(id,plan_id,class_id,sport,title,session_count,duration_minutes,objective,created_at,cycle,start_date,end_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(uid,p0.id,c.id,b.sport,b.title,b.session_count||10,b.duration_minutes||60,b.objective||null,new Date().toISOString(),Number(b.cycle||1),b.start_date||null,b.end_date||null);audit(u,'CREATE','unit',uid,b);return json(res,201,{id:uid})}

 if(p.startsWith('/api/classes/')&&method==='PUT'){if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);const cid=p.split('/').pop(),b=await body(req),row=db.prepare('SELECT * FROM classes WHERE id=?').get(cid);if(!row)return json(res,404,{error:'القسم غير موجود'});const teacherCanAccess=u.role==='teacher'&&(row.teacher_id===u.id||db.prepare('SELECT 1 FROM timetable WHERE class_id=? AND teacher_id=?').get(cid,u.id));if(u.role==='teacher'&&!teacherCanAccess)return deny(res);if(u.role!=='owner'&&!sameInst(u,row.institution_id))return deny(res);const name=String(b.name||row.name).trim();if(!name)return json(res,400,{error:'اسم القسم مطلوب'});let teacherId=u.role==='teacher'?row.teacher_id:(b.teacher_id||row.teacher_id);if(teacherId){const t=db.prepare("SELECT * FROM users WHERE id=? AND role='teacher'").get(teacherId);if(!t||t.institution_id!==row.institution_id)return deny(res,'يجب أن يكون الأستاذ من المؤسسة نفسها')}db.prepare('UPDATE classes SET name=?,level=?,year_label=?,teacher_id=?,active=? WHERE id=?').run(name,b.level??row.level,b.year_label??row.year_label,teacherId,b.active===undefined?row.active:(b.active?1:0),cid);audit(u,'UPDATE','class',cid,b);return json(res,200,{ok:true})}
 if(p.startsWith('/api/classes/')&&method==='DELETE'){if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);const cid=p.split('/').pop(),row=db.prepare('SELECT * FROM classes WHERE id=?').get(cid);if(!row)return json(res,404,{error:'القسم غير موجود'});const teacherCanAccess=u.role==='teacher'&&(row.teacher_id===u.id||db.prepare('SELECT 1 FROM timetable WHERE class_id=? AND teacher_id=?').get(cid,u.id));if(u.role==='teacher'&&!teacherCanAccess)return deny(res);if(u.role!=='owner'&&!sameInst(u,row.institution_id))return deny(res);const n=db.prepare('SELECT COUNT(*) c FROM students WHERE class_id=?').get(cid).c;db.prepare('DELETE FROM daily_entries WHERE session_id IN (SELECT id FROM sessions WHERE class_id=?)').run(cid);db.prepare('DELETE FROM attendance WHERE session_id IN (SELECT id FROM sessions WHERE class_id=?)').run(cid);db.prepare('DELETE FROM logbook_entries WHERE class_id=?').run(cid);db.prepare('DELETE FROM assessment_results WHERE assessment_id IN (SELECT id FROM assessments WHERE class_id=?)').run(cid);db.prepare('DELETE FROM assessments WHERE class_id=?').run(cid);db.prepare('DELETE FROM sessions WHERE class_id=?').run(cid);db.prepare('DELETE FROM units WHERE class_id=?').run(cid);db.prepare('DELETE FROM timetable WHERE class_id=?').run(cid);db.prepare('DELETE FROM students WHERE class_id=?').run(cid);db.prepare('DELETE FROM classes WHERE id=?').run(cid);audit(u,'DELETE','class',cid,{});return json(res,200,{ok:true})}
 if(p==='/api/teacher/statistics'&&method==='GET'&&u.role==='teacher'){const q=new URL(req.url,'http://localhost').searchParams,from=q.get('from')||'2026-09-01',to=q.get('to')||'2027-07-31';const sessions=db.prepare(`SELECT status,COUNT(*) c FROM sessions WHERE teacher_id=? AND session_date BETWEEN ? AND ? GROUP BY status`).all(u.id,from,to);const daily=db.prepare(`SELECT d.status,COUNT(*) c FROM daily_entries d JOIN sessions s ON s.id=d.session_id WHERE s.teacher_id=? AND s.session_date BETWEEN ? AND ? GROUP BY d.status`).all(u.id,from,to);const classes=db.prepare(`SELECT c.id,c.name,COUNT(s.id) students FROM classes c LEFT JOIN students s ON s.class_id=c.id WHERE c.teacher_id=? GROUP BY c.id,c.name ORDER BY c.name`).all(u.id);const assessments=db.prepare(`SELECT COUNT(*) c FROM assessments WHERE teacher_id=? AND assessment_date BETWEEN ? AND ?`).get(u.id,from,to).c;const logbook=db.prepare(`SELECT status,COUNT(*) c FROM logbook_entries WHERE teacher_id=? AND entry_date BETWEEN ? AND ? GROUP BY status`).all(u.id,from,to);return json(res,200,{from,to,sessions,daily,classes,assessments,logbook})}
 if(p==='/api/sessions'&&method==='GET'){if(u.role==='teacher'){const q=new URL(req.url,'http://localhost').searchParams;const requested=q.get('date');const today=localDateParts(q.get('now')||undefined).date;if(!requested||requested===today)syncTeacherSessions(u.id,q.get('now')||undefined);if(requested)syncTeacherScheduleForDate(u.id,requested);else syncTeacherScheduleForDate(u.id,today);}let rows;if(u.role==='inspector')rows=db.prepare(`SELECT s.*,c.name class_name,u.full_name teacher_name FROM sessions s JOIN classes c ON c.id=s.class_id JOIN users u ON u.id=s.teacher_id WHERE c.institution_id IN (SELECT institution_id FROM inspector_institutions WHERE inspector_id=?) ORDER BY s.session_date DESC`).all(u.id);else {const qd=url.searchParams.get('date');const where=`WHERE c.institution_id=? ${u.role==='teacher'?'AND s.teacher_id=?':''}${qd?' AND s.session_date=?':''}`;const args=u.role==='teacher'?[u.institution_id,u.id,...(qd?[qd]:[])]:[u.institution_id,...(qd?[qd]:[])];rows=db.prepare(`SELECT s.*,c.name class_name,u.full_name teacher_name,un.title unit_title FROM sessions s JOIN classes c ON c.id=s.class_id JOIN users u ON u.id=s.teacher_id LEFT JOIN units un ON un.id=s.unit_id ${where} ORDER BY s.session_date DESC,s.start_time ASC`).all(...args);}return json(res,200,rows)}

 if(p.startsWith('/api/sessions/')&&method==='GET'){
   if(u.role!=='teacher')return deny(res);
   const sid=p.split('/').pop(),s=db.prepare(`SELECT s.*,c.name class_name,c.institution_id,un.title unit_title FROM sessions s JOIN classes c ON c.id=s.class_id LEFT JOIN units un ON un.id=s.unit_id WHERE s.id=? AND s.teacher_id=?`).get(sid,u.id);
   if(!s)return json(res,404,{error:'الحصة المطلوبة غير موجودة'});return json(res,200,s);
 }
 if(p.startsWith('/api/sessions/')&&method==='POST'&&['start','finish','reason'].includes(p.split('/').pop())){
   if(u.role!=='teacher')return deny(res);
   const action=p.split('/').pop(),sid=p.split('/')[3],s=db.prepare('SELECT s.*,c.institution_id,c.name class_name FROM sessions s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND s.teacher_id=?').get(sid,u.id); if(!s)return json(res,404,{error:'الحصة المطلوبة غير موجودة'});
   const b=await body(req),now=new Date().toISOString();
   if(action==='start'){
     if(['completed','in_progress'].includes(s.status))return json(res,409,{error:'الحصة بدأت أو انتهت بالفعل'});
     if(s.status==='needs_reason')return json(res,409,{error:'هذه الحصة مسجلة كغير منجزة. أدخل السبب أولاً.'});
     if(!b.objective||!String(b.objective).trim())return json(res,400,{error:'هدف الحصة مطلوب'});
     const objective=String(b.objective).trim(),content=String(b.content||objective).trim();
     const startStamp=(s.session_date&&s.start_time)?`${s.session_date}T${s.start_time}:00`:now;
     const lid=id(); db.prepare('INSERT INTO logbook_entries(id,teacher_id,class_id,entry_date,horaire,content,remark,status,reason,session_id) VALUES(?,?,?,?,?,?,?,?,?,?)').run(lid,u.id,s.class_id,s.session_date,`${s.start_time||''}${s.end_time?' – '+s.end_time:''}`,objective,'','in_progress',null,sid);
     db.prepare("UPDATE sessions SET status='in_progress',objective=?,content=?,started_at=?,logbook_entry_id=? WHERE id=?").run(objective,content,startStamp,lid,sid); audit(u,'START','session',sid,{objective}); return json(res,200,{ok:true,status:'in_progress',logbook_entry_id:lid});
   }
   if(action==='finish'){
     db.prepare("UPDATE sessions SET status='completed',ended_at=? WHERE id=? AND teacher_id=?").run(now,sid,u.id);
     const lid=s.logbook_entry_id||db.prepare('SELECT id FROM logbook_entries WHERE session_id=?').get(sid)?.id; if(lid)db.prepare("UPDATE logbook_entries SET status='completed' WHERE id=?").run(lid); audit(u,'FINISH','session',sid,{}); return json(res,200,{ok:true,status:'completed'});
   }
   if(action==='reason'){
     const reason=String(b.reason||'').trim(); if(!reason)return json(res,400,{error:'السبب مطلوب'});
     db.prepare("UPDATE sessions SET status='not_held',reason=?,ended_at=? WHERE id=? AND teacher_id=?").run(reason,now,sid,u.id);
     const lid=s.logbook_entry_id||db.prepare('SELECT id FROM logbook_entries WHERE session_id=?').get(sid)?.id;
     if(lid) db.prepare("UPDATE logbook_entries SET status='not_held',content=?,reason=? WHERE id=?").run(reason,reason,lid); else {const nid=id();db.prepare('INSERT INTO logbook_entries(id,teacher_id,class_id,entry_date,horaire,content,remark,status,reason,session_id) VALUES(?,?,?,?,?,?,?,?,?,?)').run(nid,u.id,s.class_id,s.session_date,`${s.start_time||''}${s.end_time?' – '+s.end_time:''}`,reason,'','not_held',reason,sid);db.prepare('UPDATE sessions SET logbook_entry_id=? WHERE id=?').run(nid,sid)}
     const existing=db.prepare("SELECT id FROM notifications WHERE user_id=? AND type='session_missed' AND related_id=?").get(u.id,sid); if(existing)db.prepare('UPDATE notifications SET read_at=? WHERE id=?').run(now,existing.id); audit(u,'REASON','session',sid,{reason}); return json(res,200,{ok:true,status:'not_held'});
   }
 }
 if(p.startsWith('/api/sessions/')&&method==='PUT'){
   if(u.role!=='teacher')return deny(res);
   const sid=p.split('/').pop(),b=await body(req),s=db.prepare('SELECT * FROM sessions WHERE id=? AND teacher_id=?').get(sid,u.id);
   if(!s)return json(res,404,{error:'الحصة المطلوبة غير موجودة'});
   const c=db.prepare('SELECT * FROM classes WHERE id=? AND teacher_id=?').get(b.class_id||s.class_id,u.id); if(!c)return deny(res);
   if(b.session_date){seedTeacherHolidays(c.institution_id);const h=db.prepare('SELECT * FROM holidays WHERE institution_id=? AND date=? LIMIT 1').get(c.institution_id,b.session_date);if(h)return json(res,409,{error:'لا يمكن وضع الحصة في عطلة رسمية: '+h.label});}
   db.prepare('UPDATE sessions SET class_id=?,unit_id=?,session_date=?,start_time=?,end_time=?,objective=?,content=? WHERE id=? AND teacher_id=?').run(c.id,b.unit_id||null,b.session_date||s.session_date,b.start_time||null,b.end_time||null,b.objective||null,b.content||null,sid,u.id);
   audit(u,'UPDATE','session',sid,b);return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/sessions/')&&method==='DELETE'){
   if(u.role!=='teacher')return deny(res);
   const sid=p.split('/').pop(),s=db.prepare('SELECT * FROM sessions WHERE id=? AND teacher_id=?').get(sid,u.id);if(!s)return json(res,404,{error:'الحصة المطلوبة غير موجودة'});
   db.prepare('DELETE FROM daily_entries WHERE session_id=?').run(sid);db.prepare('DELETE FROM logbook_entries WHERE session_id=?').run(sid);db.prepare('DELETE FROM notifications WHERE related_id=? AND user_id=?').run(sid,u.id);db.prepare('DELETE FROM sessions WHERE id=? AND teacher_id=?').run(sid,u.id);audit(u,'DELETE','session',sid,{});return json(res,200,{ok:true});
 }
 if(p==='/api/sessions'&&method==='POST'){if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);const b=await body(req),c=db.prepare('SELECT * FROM classes WHERE id=?').get(b.class_id);if(!accessibleClass(u,c))return deny(res);if(u.role==='teacher')seedTeacherHolidays(c.institution_id);if(b.session_date){const h=db.prepare('SELECT * FROM holidays WHERE institution_id=? AND date=? LIMIT 1').get(c.institution_id,b.session_date);if(h)return json(res,409,{error:tr(locale(req),'لا يمكن برمجة حصة في عطلة رسمية: '+h.label,'Impossible de programmer une séance pendant un jour férié : '+h.label,'A session cannot be scheduled on an official holiday: '+h.label)});}const sid=id();db.prepare('INSERT INTO sessions(id,unit_id,class_id,teacher_id,session_date,start_time,end_time,objective,content,status,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(sid,b.unit_id||null,c.id,b.teacher_id||u.id,b.session_date,b.start_time||null,b.end_time||null,b.objective||null,b.content||null,b.status||'planned',b.reason||null,new Date().toISOString());audit(u,'CREATE','session',sid,b);return json(res,201,{id:sid})}
 // daily / logbook
 if(p==='/api/teacher/eps-carnet'&&method==='GET'&&u.role==='teacher'){
  const cid=url.searchParams.get('class_id'); const uid=url.searchParams.get('unit_id');
  if(!cid)return json(res,400,{error:'القسم مطلوب'});
  const c=db.prepare(`SELECT id,name,level,year_label FROM classes WHERE id=? AND institution_id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))`).get(cid,u.institution_id,u.id,u.id);
  if(!c)return deny(res,'القسم غير متاح للأستاذ');
  let units=db.prepare(`SELECT un.id,un.title,un.sport,un.session_count,un.duration_minutes,un.objective,un.cycle,un.start_date,un.end_date
    FROM units un JOIN annual_plans ap ON ap.id=un.plan_id
    WHERE un.class_id=? AND ap.teacher_id=? ${uid?'AND un.id=?':''}
    ORDER BY COALESCE(un.cycle,99),COALESCE(un.start_date,'9999-12-31'),un.created_at`).all(...(uid?[cid,u.id,uid]:[cid,u.id]));
  const students=db.prepare(`SELECT id,massar_number,first_name,last_name,gender,dob FROM students WHERE class_id=? ORDER BY CASE WHEN massar_number GLOB '[0-9]*' THEN CAST(massar_number AS INTEGER) ELSE 999999999 END,last_name,first_name,id`).all(cid);
  const out=[];
  for(const un of units){
    const sessions=db.prepare(`SELECT se.id,se.session_date,se.start_time,se.end_time,se.status,se.objective,se.content
      FROM sessions se WHERE se.teacher_id=? AND se.class_id=? AND se.unit_id=? ORDER BY se.session_date,se.start_time,se.created_at`).all(u.id,cid,un.id);
    const attendance=sessions.length?db.prepare(`SELECT d.session_id,d.student_id,d.status,d.remark,d.behavior_score,d.behavior_note FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE se.teacher_id=? AND se.class_id=? AND se.unit_id=?`).all(u.id,cid,un.id):[];
    const aMap={}; for(const a of attendance)aMap[`${a.student_id}|${a.session_id}`]=a;
    const assessments=db.prepare(`SELECT a.id,a.title,a.assessment_date,a.scale,a.criterion,a.type,ar.student_id,ar.score,ar.remark,ab.base_score,ab.deduction,ab.final_score
      FROM assessments a LEFT JOIN assessment_results ar ON ar.assessment_id=a.id LEFT JOIN assessment_behavior ab ON ab.assessment_id=a.id AND ab.student_id=ar.student_id
      WHERE a.teacher_id=? AND a.class_id=? AND a.unit_id=? ORDER BY a.assessment_date DESC`).all(u.id,cid,un.id);
    const evals={}; for(const a of assessments){if(!evals[a.id])evals[a.id]={id:a.id,title:a.title,assessment_date:a.assessment_date,scale:a.scale,criterion:a.criterion,type:a.type,results:{}}; if(a.student_id)evals[a.id].results[a.student_id]={score:a.score,remark:a.remark,base_score:a.base_score,deduction:a.deduction,final_score:a.final_score};}
    out.push({unit:un,sessions,students,attendance:aMap,assessments:Object.values(evals)});
  }
  return json(res,200,{class:c,units:out});
 }
 if(p==='/api/teacher/daily-history'&&method==='GET'&&u.role==='teacher'){
  const cid=url.searchParams.get('class_id');
  if(!cid)return json(res,400,{error:'القسم مطلوب'});
  const c=db.prepare(`SELECT id,name,level,year_label FROM classes WHERE id=? AND institution_id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))`).get(cid,u.institution_id,u.id,u.id);
  if(!c)return deny(res,'القسم غير متاح للأستاذ');
  const sessions=db.prepare(`SELECT s.id,s.class_id,s.teacher_id,s.session_date,s.start_time,s.end_time,s.status,s.objective,s.content,s.unit_id,un.title unit_title,un.sport
    FROM sessions s LEFT JOIN units un ON un.id=s.unit_id
    WHERE s.teacher_id=? AND s.class_id=? ORDER BY s.session_date DESC,s.start_time ASC,s.created_at ASC`).all(u.id,cid);
  const students=db.prepare(`SELECT id,massar_number,first_name,last_name,gender,dob FROM students WHERE class_id=? ORDER BY CASE WHEN massar_number GLOB '[0-9]*' THEN CAST(massar_number AS INTEGER) ELSE 999999999 END,last_name,first_name,id`).all(cid);
  const entries=sessions.length?db.prepare(`SELECT d.session_id,d.student_id,d.status,d.remark,d.behavior_score,d.behavior_note FROM daily_entries d JOIN sessions s ON s.id=d.session_id WHERE s.teacher_id=? AND s.class_id=?`).all(u.id,cid):[];
  const map={}; for(const x of entries)map[`${x.session_id}|${x.student_id}`]=x;
  return json(res,200,{class:c,students,sessions,entries:map});
 }
 if(p==='/api/daily'&&method==='GET'){
  if(u.role!=='teacher')return deny(res,'الدفتر اليومي خاص بالأستاذ');
  const sid=url.searchParams.get('session_id');
  if(!sid)return json(res,400,{error:'معرّف الحصة مطلوب'});
  // Always return the COMPLETE roster of the session's class. Attendance rows are optional;
  // a missing daily row means the student has not yet been explicitly marked.
  const session=db.prepare(`SELECT se.id,se.class_id,se.teacher_id FROM sessions se WHERE se.id=? AND se.teacher_id=?`).get(sid,u.id);
  if(!session)return deny(res,'الحصة غير موجودة أو غير تابعة للأستاذ');
  const rows=db.prepare(`
    SELECT s.id AS student_id,s.first_name,s.last_name,s.massar_number,s.dob,s.gender,s.birth_place,
           s.photo_path,s.health_note,s.eps_note,s.health_profile_json,s.profile_json,
           COALESCE(d.status,'present') AS status,COALESCE(d.remark,'') AS remark,d.behavior_score,d.behavior_note
    FROM students s
    LEFT JOIN daily_entries d ON d.student_id=s.id AND d.session_id=?
    WHERE s.class_id=?
    ORDER BY CASE WHEN s.massar_number GLOB '[0-9]*' THEN CAST(s.massar_number AS INTEGER) ELSE 999999999 END,
             s.last_name,s.first_name,s.id`).all(sid,session.class_id);
  return json(res,200,rows);
}
 if(p==='/api/daily'&&method==='POST'){if(u.role!=='teacher')return deny(res);const b=await body(req),se=db.prepare('SELECT * FROM sessions WHERE id=?').get(b.session_id),st=db.prepare('SELECT s.* FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))').get(b.student_id,u.id,u.id);if(!se||se.teacher_id!==u.id||!st)return deny(res);const allowedDaily=['present','absent','uniform','sick','late','other'];if(!allowedDaily.includes(String(b.status||'')))return json(res,400,{error:'حالة التلميذ غير صالحة'});const bs=b.behavior_score===''||b.behavior_score==null?null:Number(b.behavior_score);if(bs!=null&&(bs<0||bs>4))return json(res,400,{error:'قيمة السلوك يجب أن تكون بين 0 و4'});db.prepare(`INSERT INTO daily_entries(id,session_id,student_id,status,remark,behavior_score,behavior_note) VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status,remark=excluded.remark,behavior_score=excluded.behavior_score,behavior_note=excluded.behavior_note`).run(id(),b.session_id,b.student_id,b.status,b.remark||null,bs,b.behavior_note||null);return json(res,200,{ok:true})}
 if(p==='/api/logbook'&&method==='GET'){if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);if(u.role==='teacher')syncTeacherSessions(u.id,new URL(req.url,'http://localhost').searchParams.get('now')||undefined);let rows;if(u.role==='teacher')rows=db.prepare('SELECT l.*,c.name class_name FROM logbook_entries l JOIN classes c ON c.id=l.class_id WHERE l.teacher_id=? ORDER BY l.entry_date DESC,l.horaire ASC').all(u.id);else rows=db.prepare(`SELECT l.*,c.name class_name FROM logbook_entries l JOIN classes c ON c.id=l.class_id WHERE c.institution_id=? ORDER BY l.entry_date DESC,l.horaire ASC`).all(u.institution_id);if(u.role==='teacher'&&url.searchParams.get('full')==='1'){const hs=db.prepare('SELECT * FROM holidays WHERE institution_id=? AND date IS NOT NULL').all(u.institution_id);const hm=new Map(hs.map(h=>[h.date,h]));const slots=db.prepare('SELECT tt.*,c.name class_name FROM timetable tt JOIN classes c ON c.id=tt.class_id WHERE tt.teacher_id=? ORDER BY tt.day_of_week,tt.start_time').all(u.id);const by=new Map(rows.map(r=>[`${r.entry_date}|${r.class_id}|${r.horaire}`,r]));const out=[];const from=new Date('2026-09-01T12:00:00'),to=new Date('2027-07-31T12:00:00');for(let d=new Date(from);d<=to;d.setDate(d.getDate()+1)){const iso=d.toISOString().slice(0,10),dow=d.getDay(),h=hm.get(iso);if(h){out.push({id:'holiday-'+h.id,entry_date:iso,class_id:null,class_name:'—',horaire:'—',content:'عطلة',remark:h.label,status:'holiday'});continue}for(const tt of slots.filter(x=>String(x.day_of_week)===String(dow))){const horaire=`${tt.start_time||''}${tt.end_time?' – '+tt.end_time:''}`;const existing=by.get(`${iso}|${tt.class_id}|${horaire}`); const unit=db.prepare('SELECT un.id,un.sport,un.title,un.session_count FROM units un JOIN annual_plans ap ON ap.id=un.plan_id WHERE un.class_id=? AND ap.teacher_id=? AND (un.start_date IS NULL OR un.start_date<=?) AND (un.end_date IS NULL OR un.end_date>=?) ORDER BY CASE WHEN un.start_date IS NULL THEN 1 ELSE 0 END,un.start_date ASC,un.cycle ASC,un.created_at ASC LIMIT 1').get(tt.class_id,u.id,iso,iso); const previous=unit?db.prepare('SELECT COUNT(*) c FROM sessions WHERE teacher_id=? AND class_id=? AND unit_id=? AND session_date<?').get(u.id,tt.class_id,unit.id,iso).c:0; out.push(existing?{...existing,sport:unit?.sport||unit?.title||'',session_number:unit?`${previous+1}/${unit.session_count||''}`:''}:{id:`planned-${iso}-${tt.id}`,entry_date:iso,class_id:tt.class_id,class_name:tt.class_name,horaire,content:'',remark:'',status:'planned',sport:unit?.sport||unit?.title||'',session_number:unit?`${previous+1}/${unit.session_count||''}`:''});}}return json(res,200,out)}return json(res,200,rows)}
 if(p.startsWith('/api/logbook/')&&method==='PUT'){
   if(u.role!=='teacher')return deny(res);
   const lid=p.split('/').pop(),b=await body(req);
   const row=db.prepare('SELECT * FROM logbook_entries WHERE id=? AND teacher_id=?').get(lid,u.id);
   if(!row)return json(res,404,{error:'سجل دفتر النصوص غير موجود'});
   const c=db.prepare('SELECT * FROM classes WHERE id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))').get(row.class_id,u.id,u.id);
   if(!c)return deny(res);
   db.prepare('UPDATE logbook_entries SET entry_date=?,horaire=?,content=?,remark=?,status=?,reason=?,session_id=? WHERE id=? AND teacher_id=?').run(b.entry_date??row.entry_date,b.horaire??row.horaire,b.content??row.content,b.remark??row.remark,b.status??row.status,b.reason??row.reason,b.session_id??row.session_id,lid,u.id);
   audit(u,'UPDATE','logbook_entry',lid,b);
   return json(res,200,{ok:true});
 }
 if(p==='/api/logbook'&&method==='POST'){if(u.role!=='teacher')return deny(res);const b=await body(req),c=db.prepare('SELECT * FROM classes WHERE id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))').get(b.class_id,u.id,u.id);if(!c)return deny(res);seedTeacherHolidays(c.institution_id);const h=b.entry_date?db.prepare('SELECT * FROM holidays WHERE institution_id=? AND date=? LIMIT 1').get(c.institution_id,b.entry_date):null;if(h&&(b.status||'completed')==='completed')return json(res,409,{error:tr(locale(req),'هذا التاريخ عطلة رسمية. سجّل الحصة كـ لم تنجز مع السبب إذا كنت تريد توثيقها.','Cette date est un jour férié. Enregistrez la séance comme non réalisée avec le motif si vous souhaitez la documenter.','This date is an official holiday. Record the session as not held with the reason if you want to document it.')});const lid=id();db.prepare('INSERT INTO logbook_entries(id,teacher_id,class_id,entry_date,horaire,content,remark,status,reason,session_id) VALUES(?,?,?,?,?,?,?,?,?,?)').run(lid,u.id,c.id,b.entry_date,b.horaire||'',b.content||'',b.remark||'',b.status||'completed',b.reason||null,b.session_id||null);return json(res,201,{id:lid})}
 // teacher lesson sheets, holidays and richer assessment
 if(p==='/api/holidays'&&method==='GET'){if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);if(u.role!=='owner')seedTeacherHolidays(u.institution_id);const rows=u.role==='owner'?db.prepare('SELECT h.*,i.name institution_name FROM holidays h LEFT JOIN institutions i ON i.id=h.institution_id ORDER BY h.date').all():db.prepare('SELECT * FROM holidays WHERE institution_id=? ORDER BY CASE WHEN date IS NULL THEN 1 ELSE 0 END,date').all(u.institution_id);return json(res,200,rows)}
 if(p==='/api/holidays'&&method==='POST'){if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);const b=await body(req);if(!b.date||!b.label)return json(res,400,{error:'التاريخ واسم العطلة مطلوبان'});const inst=u.role==='owner'?b.institution_id:u.institution_id;if(!inst)return json(res,400,{error:'المؤسسة مطلوبة'});const hid=id();db.prepare('INSERT INTO holidays(id,institution_id,school_year,date,label,kind) VALUES(?,?,?,?,?,?)').run(hid,inst,b.school_year||'2026-2027',b.date,b.label,b.kind||'official');audit(u,'CREATE','holiday',hid,b);return json(res,201,{id:hid})}
 if(p==='/api/lesson-sheets'&&method==='GET'){if(u.role!=='teacher')return deny(res);const rows=db.prepare(`SELECT ls.*,c.name class_name,un.title unit_title FROM lesson_sheets ls LEFT JOIN classes c ON c.id=ls.class_id LEFT JOIN units un ON un.id=ls.unit_id WHERE ls.teacher_id=? ORDER BY ls.updated_at DESC`).all(u.id);return json(res,200,rows.map(x=>({...x,steps:JSON.parse(x.steps_json||'[]'),schema:JSON.parse(x.schema_json||'{}')})))}
 if(p==='/api/lesson-sheets'&&method==='POST'){if(u.role!=='teacher')return deny(res);const b=await body(req),c=db.prepare('SELECT * FROM classes WHERE id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))').get(b.class_id,u.id,u.id);if(!c)return deny(res);const sid=id();db.prepare('INSERT INTO lesson_sheets(id,teacher_id,class_id,unit_id,title,module,aps_family,aps_support,school_level,session_number,effectif,material,terminal_objective,sequence_objective,session_objective,steps_json,schema_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sid,u.id,c.id,b.unit_id||null,b.title||'Fiche de séance',b.module||'',b.aps_family||'',b.aps_support||'',b.school_level||c.level||'',b.session_number||'',Number(b.effectif||0),b.material||'',b.terminal_objective||'',b.sequence_objective||'',b.session_objective||'',JSON.stringify(b.steps||[]),JSON.stringify(b.schema||{}));audit(u,'CREATE','lesson_sheet',sid,{class_id:c.id});return json(res,201,{id:sid})}
 if(p.startsWith('/api/lesson-sheets/')&&method==='PUT'){if(u.role!=='teacher')return deny(res);const lid=p.split('/').pop(),b=await body(req),x=db.prepare('SELECT * FROM lesson_sheets WHERE id=? AND teacher_id=?').get(lid,u.id);if(!x)return deny(res);db.prepare('UPDATE lesson_sheets SET class_id=?,unit_id=?,title=?,module=?,aps_family=?,aps_support=?,school_level=?,session_number=?,effectif=?,material=?,terminal_objective=?,sequence_objective=?,session_objective=?,steps_json=?,schema_json=?,updated_at=? WHERE id=?').run(b.class_id,x.unit_id||b.unit_id||null,b.title,b.module,b.aps_family,b.aps_support,b.school_level,b.session_number,Number(b.effectif||0),b.material,b.terminal_objective,b.sequence_objective,b.session_objective,JSON.stringify(b.steps||[]),JSON.stringify(b.schema||{}),new Date().toISOString(),lid);return json(res,200,{ok:true})}
 if(p.startsWith('/api/lesson-sheets/')&&method==='DELETE'){if(u.role!=='teacher')return deny(res);const lid=p.split('/').pop(),x=db.prepare('SELECT id FROM lesson_sheets WHERE id=? AND teacher_id=?').get(lid,u.id);if(!x)return json(res,404,{error:'الجذاذة غير موجودة'});db.prepare('DELETE FROM lesson_sheets WHERE id=? AND teacher_id=?').run(lid,u.id);audit(u,'DELETE','lesson_sheet',lid,{});return json(res,200,{ok:true})}
 if(p.startsWith('/api/lesson-sheets/')&&method==='GET'){if(u.role!=='teacher')return deny(res);const lid=p.split('/').pop(),x=db.prepare('SELECT * FROM lesson_sheets WHERE id=? AND teacher_id=?').get(lid,u.id);if(!x)return json(res,404,{error:'الجذاذة غير موجودة'});return json(res,200,{...x,steps:JSON.parse(x.steps_json||'[]'),schema:JSON.parse(x.schema_json||'{}')})}
 if(p==='/api/assessments'&&method==='GET'){if(u.role!=='teacher')return deny(res);const rows=db.prepare(`SELECT a.*,c.name class_name,un.title unit_title FROM assessments a JOIN classes c ON c.id=a.class_id LEFT JOIN units un ON un.id=a.unit_id WHERE a.teacher_id=? ORDER BY a.assessment_date DESC`).all(u.id);return json(res,200,rows)}
 if(p==='/api/assessments'&&method==='POST'){if(u.role!=='teacher')return deny(res);const b=await body(req),c=db.prepare('SELECT * FROM classes WHERE id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))').get(b.class_id,u.id,u.id);if(!c)return deny(res);const aid=id();db.prepare('INSERT INTO assessments(id,class_id,unit_id,teacher_id,assessment_date,type,criterion,scale,title) VALUES(?,?,?,?,?,?,?,?,?)').run(aid,c.id,b.unit_id||null,u.id,b.assessment_date||new Date().toISOString().slice(0,10),b.type||'formative',b.criterion||'',Number(b.scale||20),b.title||'Évaluation');return json(res,201,{id:aid})}
 if(p==='/api/assessment-results'&&method==='POST'){if(u.role!=='teacher')return deny(res);const b=await body(req),a=db.prepare('SELECT * FROM assessments WHERE id=? AND teacher_id=?').get(b.assessment_id,u.id),st=db.prepare('SELECT s.* FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))').get(b.student_id,u.id);if(!a||!st||a.class_id!==st.class_id)return deny(res);db.prepare(`INSERT INTO assessment_results(id,assessment_id,student_id,score,pro_score,con_score,remark) VALUES(?,?,?,?,?,?,?) ON CONFLICT(assessment_id,student_id) DO UPDATE SET score=excluded.score,pro_score=excluded.pro_score,con_score=excluded.con_score,remark=excluded.remark`).run(id(),a.id,st.id,Number(b.score||0),b.pro_score==null?null:Number(b.pro_score),b.con_score==null?null:Number(b.con_score),b.remark||null);return json(res,200,{ok:true})}
 // professional profile and inspector requests
 if(p==='/api/profile'&&method==='GET'){if(u.role==='teacher'){return json(res,200,{user:u,profile:db.prepare('SELECT * FROM teacher_profiles WHERE user_id=?').get(u.id),documents:db.prepare('SELECT * FROM professional_documents WHERE user_id=?').all(u.id)})}return json(res,200,{user:u})}
 if(p==='/api/professional-requests'&&method==='POST'){if(u.role!=='inspector')return deny(res);const b=await body(req),t=db.prepare("SELECT * FROM users WHERE id=? AND role='teacher'").get(b.teacher_id);if(!accessibleTeacher(u,t))return deny(res);const rid=id();db.prepare('INSERT INTO professional_access_requests VALUES(?,?,?,?,?,?)').run(rid,t.id,u.id,'pending',new Date().toISOString(),null);db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),t.id,'طلب الاطلاع على الملف المهني','المفتش طلب الاطلاع على بعض معطيات ملفك المهني.','professional_access',null,new Date().toISOString(),rid);audit(u,'REQUEST','professional_access',rid,{teacher_id:t.id});return json(res,201,{id:rid,status:'pending'})}
 if(p==='/api/professional-requests'&&method==='GET'){let rows;if(u.role==='teacher')rows=db.prepare(`SELECT r.*,x.full_name inspector_name FROM professional_access_requests r JOIN users x ON x.id=r.inspector_id WHERE r.teacher_id=? ORDER BY r.created_at DESC`).all(u.id);else if(u.role==='inspector')rows=db.prepare(`SELECT r.*,x.full_name teacher_name FROM professional_access_requests r JOIN users x ON x.id=r.teacher_id WHERE r.inspector_id=? ORDER BY r.created_at DESC`).all(u.id);else return deny(res);return json(res,200,rows)}
 if(p.startsWith('/api/professional-requests/')&&method==='PATCH'){const rid=p.split('/').pop(),b=await body(req),r=db.prepare('SELECT * FROM professional_access_requests WHERE id=?').get(rid);if(!r)return json(res,404,{error:'الطلب غير موجود'});if(u.role!=='teacher'||r.teacher_id!==u.id)return deny(res);if(!['accepted','refused'].includes(b.status))return json(res,400,{error:'حالة غير صحيحة'});db.prepare('UPDATE professional_access_requests SET status=?,decided_at=? WHERE id=?').run(b.status,new Date().toISOString(),rid);audit(u,'DECIDE','professional_access',rid,{status:b.status});return json(res,200,{ok:true})}
 // invite / transfer strict
 if(p==='/api/invites'&&method==='POST'){if(u.role!=='coordinator')return deny(res);const b=await body(req),t=db.prepare("SELECT * FROM users WHERE id=? AND role='teacher'").get(b.teacher_id);if(!t||t.institution_id!==u.institution_id)return deny(res,'لا يمكن إضافة أستاذ من مؤسسة أخرى. يجب أن يكون لديه اشتراك مستقل أو أن تتم عملية انتقال رسمية.');const iid=id();db.prepare('INSERT INTO invites VALUES(?,?,?,?,?,?)').run(iid,u.institution_id,u.id,t.id,'pending',new Date().toISOString());audit(u,'CREATE','invite',iid,{teacher_id:t.id});return json(res,201,{id:iid})}
 if(p==='/api/transfers'&&method==='POST'){if(u.role!=='teacher')return deny(res);const b=await body(req),to=db.prepare('SELECT * FROM institutions WHERE id=?').get(b.to_institution_id);if(!to)return json(res,404,{error:'المؤسسة غير موجودة'});const tr=id();db.prepare('INSERT INTO transfer_requests VALUES(?,?,?,?,?,?,?,?)').run(tr,u.id,u.institution_id,to.id,u.id,0,'pending',new Date().toISOString());audit(u,'CREATE','transfer',tr,{to_institution_id:to.id});return json(res,201,{id:tr,status:'pending'})}
 // inspector dashboard data - no students/daily
 if(p==='/api/inspector/overview'&&method==='GET'){if(u.role!=='inspector')return deny(res);const insts=institutionScope(u);const ph=insts.map(x=>x.id);if(!ph.length)return json(res,200,[]);return json(res,200,db.prepare(`SELECT i.id,i.name,COUNT(DISTINCT t.id) teachers,COUNT(DISTINCT c.id) classes,COUNT(DISTINCT s.id) sessions FROM institutions i LEFT JOIN users t ON t.institution_id=i.id AND t.role='teacher' LEFT JOIN classes c ON c.institution_id=i.id LEFT JOIN sessions s ON s.class_id=c.id WHERE i.id IN (${ph.map(()=>'?').join(',')}) GROUP BY i.id,i.name`).all(...ph))}
 // reports
 if(p==='/api/reports'&&method==='GET'){if(u.role==='teacher')return json(res,200,db.prepare('SELECT * FROM reports WHERE author_id=? OR recipient_id=? ORDER BY created_at DESC').all(u.id,u.id));if(u.role==='inspector')return json(res,200,db.prepare('SELECT * FROM reports WHERE author_id=? OR (scope_type=\'institution\' AND scope_id IN (SELECT institution_id FROM inspector_institutions WHERE inspector_id=?)) ORDER BY created_at DESC').all(u.id,u.id));return json(res,200,db.prepare('SELECT * FROM reports WHERE author_id=? OR scope_id=? ORDER BY created_at DESC').all(u.id,u.institution_id))}
 if(p==='/api/reports'&&method==='POST'){const b=await body(req);if(u.role==='inspector'&&b.scope_type==='student')return deny(res,'المفتش لا ينشئ تقارير فردية عن التلاميذ');if(u.role==='coordinator'&&!sameInst(u,b.scope_id))return deny(res);const rid=id();db.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?)').run(rid,u.id,b.scope_type,b.scope_id,b.title,b.content,b.recipient_id||null,new Date().toISOString());if(b.recipient_id)db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),b.recipient_id,b.title,b.content,'report',null,new Date().toISOString(),rid);audit(u,'CREATE','report',rid,b);return json(res,201,{id:rid})}
 // Timetable OCR: read an uploaded image/PDF and return extracted text for structured import.
 if(p==='/api/timetable/ocr'&&method==='POST'&&u.role==='teacher'){
   const b=await body(req); const raw=String(b.data||'').replace(/^data:.*?;base64,/,'').replace(/\s/g,'');
   if(!raw)return json(res,400,{error:'الوثيقة مطلوبة'});
   const filename=String(b.filename||'timetable').toLowerCase();
   const ext=filename.endsWith('.pdf')?'.pdf':filename.endsWith('.png')?'.png':filename.endsWith('.webp')?'.webp':filename.endsWith('.jpeg')?'.jpeg':'.jpg';
   const tmpDir=fs.mkdtempSync(path.join('/tmp','eps-timetable-')); const input=path.join(tmpDir,'input'+ext);
   try{
     fs.writeFileSync(input,Buffer.from(raw,'base64'));
     const script=`import sys, json, os, subprocess, tempfile\nfrom PIL import Image, ImageOps, ImageEnhance\nimport pytesseract\np=sys.argv[1]; out=[]\ntry:\n  if p.lower().endswith('.pdf'):\n    pref=os.path.join(os.path.dirname(p),'page')\n    q=subprocess.run(['pdftoppm','-f','1','-singlefile','-r','220','-png',p,pref],capture_output=True,text=True)\n    if q.returncode!=0: raise RuntimeError(q.stderr or 'PDF conversion failed')\n    p=pref+'.png'\n  im=Image.open(p).convert('RGB')\n  im=ImageOps.exif_transpose(im)\n  if im.width<1600: im=im.resize((int(im.width*1600/im.width),int(im.height*1600/im.width)))\n  gray=ImageOps.grayscale(im)\n  gray=ImageEnhance.Contrast(gray).enhance(1.7)\n  text=pytesseract.image_to_string(gray,lang='ara+fra+eng',config='--psm 6')\n  print(json.dumps({'text':text},ensure_ascii=False))\nexcept Exception as e:\n  print(json.dumps({'error':str(e)},ensure_ascii=False))`;
     const py=process.platform==='win32'?'python':'python3'; const out=spawnSync(py,['-c',script,input],{encoding:'utf8',maxBuffer:20*1024*1024});
     if(out.status!==0)return json(res,500,{error:String(out.stderr||'تعذر تشغيل قارئ الوثيقة')});
     let result={};try{result=JSON.parse(String(out.stdout||'{}').trim())}catch{result={}};
     if(result.error)return json(res,400,{error:result.error});
     audit(u,'OCR','timetable',u.id,{filename}); return json(res,200,{ok:true,text:String(result.text||''),filename});
   }finally{try{fs.rmSync(tmpDir,{recursive:true,force:true})}catch{}}
 }
 // Teacher timetable: read/manage own schedule. Coordinator/owner can manage institutional schedule.
 if(p==='/api/timetable/import'&&method==='POST'){
   if(u.role!=='teacher')return deny(res);
   const b=await body(req),rows=Array.isArray(b.rows)?b.rows:[]; if(!rows.length)return json(res,400,{error:'لا توجد حصص للاستيراد'});
   const classes=db.prepare('SELECT id,name FROM classes WHERE teacher_id=? AND institution_id=?').all(u.id,u.institution_id); const byName=new Map(classes.map(c=>[String(c.name).trim().toLowerCase(),c]));
   let added=0,updated=0,invalid=0,unknownClasses=[];
   for(const r of rows){
     const day=String(r.day_of_week??r.day??'').trim(),st=String(r.start_time??r.start??'').trim(),en=String(r.end_time??r.end??'').trim(),cn=String(r.class_name??r.class??'').trim(),activity=String(r.activity??r.subject??'EPS').trim();
     const c=byName.get(cn.toLowerCase()) || classes.find(x=>x.name.toLowerCase()===cn.toLowerCase());
     if(!day||!st||!en||!c){invalid++;if(cn&&!c&&!unknownClasses.includes(cn))unknownClasses.push(cn);continue;}
     const existing=db.prepare('SELECT id FROM timetable WHERE teacher_id=? AND class_id=? AND day_of_week=? AND start_time=? LIMIT 1').get(u.id,c.id,day,st);
     if(existing){db.prepare('UPDATE timetable SET end_time=?,activity=? WHERE id=?').run(en,activity,existing.id);updated++;}
     else{db.prepare('INSERT INTO timetable VALUES(?,?,?,?,?,?,?,?,?)').run(id(),u.institution_id,u.id,c.id,day,st,en,activity,r.facility_id||null);added++;}
   }
   audit(u,'IMPORT','timetable',u.id,{added,updated,invalid,unknownClasses}); return json(res,200,{added,updated,invalid,unknownClasses});
 }
 if(p.startsWith('/api/timetable/')&&method==='PUT'){
   if(!['teacher','coordinator','owner'].includes(u.role))return deny(res); const tid=p.split('/').pop(),b=await body(req); const row=db.prepare('SELECT * FROM timetable WHERE id=?').get(tid); if(!row)return json(res,404,{error:'حصة استعمال الزمن غير موجودة'}); if(u.role==='teacher'&&row.teacher_id!==u.id)return deny(res); if(u.role!=='teacher'&&!sameInst(u,row.institution_id))return deny(res);
   const teacherId=u.role==='teacher'?u.id:(b.teacher_id||row.teacher_id),inst=u.role==='teacher'?u.institution_id:row.institution_id; if(!b.class_id||b.day_of_week===undefined||b.day_of_week===null||String(b.day_of_week).trim()===''||!b.start_time||!b.end_time)return json(res,400,{error:'القسم واليوم والوقت مطلوبة'});
   const c=db.prepare('SELECT * FROM classes WHERE id=?').get(b.class_id); const teacher=db.prepare("SELECT * FROM users WHERE id=? AND role='teacher' AND institution_id=? AND active=1").get(teacherId,inst); if(!teacher||!c||c.institution_id!==inst||(u.role==='teacher'&&c.teacher_id!==u.id))return deny(res,'يجب اختيار أستاذ وقسم تابعين للمؤسسة'); if(b.start_time>=b.end_time)return json(res,400,{error:'وقت النهاية يجب أن يكون بعد وقت البداية'}); const conflict=db.prepare("SELECT id FROM timetable WHERE teacher_id=? AND day_of_week=? AND start_time < ? AND end_time > ? AND id<>? LIMIT 1").get(teacherId,String(b.day_of_week),b.end_time,b.start_time,tid); if(conflict)return json(res,409,{error:'يوجد تعارض في استعمال زمن الأستاذ خلال هذا التوقيت'});
   db.prepare('UPDATE timetable SET teacher_id=?,class_id=?,day_of_week=?,start_time=?,end_time=?,activity=?,facility_id=? WHERE id=?').run(teacherId,c.id,String(b.day_of_week),b.start_time,b.end_time,b.activity||'EPS',b.facility_id||null,tid); audit(u,'UPDATE','timetable',tid,b); return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/timetable/')&&method==='DELETE'){
   if(!['teacher','coordinator','owner'].includes(u.role))return deny(res); const tid=p.split('/').pop(),row=db.prepare('SELECT * FROM timetable WHERE id=?').get(tid); if(!row)return json(res,404,{error:'حصة استعمال الزمن غير موجودة'}); if(u.role==='teacher'&&row.teacher_id!==u.id)return deny(res); if(u.role!=='teacher'&&!sameInst(u,row.institution_id))return deny(res); db.prepare('DELETE FROM timetable WHERE id=?').run(tid); audit(u,'DELETE','timetable',tid,{}); return json(res,200,{ok:true});
 }
 if(p===`/api/timetable`&&method==='GET'){if(u.role==='teacher'){const teacherId=url.searchParams.get('teacher_id')||u.id;if(teacherId!==u.id)return deny(res);return json(res,200,db.prepare(`SELECT tt.*,c.name class_name FROM timetable tt LEFT JOIN classes c ON c.id=tt.class_id WHERE tt.teacher_id=? AND tt.institution_id=? ORDER BY CAST(tt.day_of_week AS INTEGER),tt.start_time`).all(u.id,u.institution_id));}if(!['coordinator','owner'].includes(u.role))return deny(res);return json(res,200,db.prepare(`SELECT tt.*,c.name class_name,u.full_name teacher_name FROM timetable tt LEFT JOIN classes c ON c.id=tt.class_id LEFT JOIN users u ON u.id=tt.teacher_id WHERE ${u.role==='owner'?'1=1':'tt.institution_id=?'} ORDER BY CAST(tt.day_of_week AS INTEGER),tt.start_time`).all(...(u.role==='owner'?[]:[u.institution_id])))}
 if(p===`/api/timetable`&&method==='POST'){if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);const b=await body(req);const inst=u.role==='teacher'?u.institution_id:(b.institution_id||u.institution_id);if(!sameInst(u,inst))return deny(res);const teacherId=u.role==='teacher'?u.id:b.teacher_id;const c=db.prepare('SELECT * FROM classes WHERE id=?').get(b.class_id);const teacher=u.role==='teacher'?u:db.prepare("SELECT * FROM users WHERE id=? AND role='teacher' AND institution_id=? AND active=1").get(teacherId,inst);if(!teacherId||!teacher||!c||c.institution_id!==inst||(u.role==='teacher'&&c.teacher_id!==u.id))return deny(res,'يجب اختيار أستاذ وقسم تابعين للمؤسسة');if(b.day_of_week===undefined||b.day_of_week===null||String(b.day_of_week).trim()===''||!b.start_time||!b.end_time)return json(res,400,{error:'القسم واليوم والتوقيت مطلوبة'});if(b.start_time>=b.end_time)return json(res,400,{error:'وقت النهاية يجب أن يكون بعد وقت البداية'});const conflict=db.prepare("SELECT id FROM timetable WHERE teacher_id=? AND day_of_week=? AND start_time < ? AND end_time > ? LIMIT 1").get(teacherId,String(b.day_of_week),b.end_time,b.start_time);if(conflict)return json(res,409,{error:'يوجد تعارض في استعمال زمن الأستاذ خلال هذا التوقيت'});const nid=id();db.prepare('INSERT INTO timetable VALUES(?,?,?,?,?,?,?,?,?)').run(nid,inst,teacherId,c.id,String(b.day_of_week),b.start_time,b.end_time,b.activity||'EPS',b.facility_id||null);audit(u,'CREATE','timetable',nid,b);return json(res,201,{id:nid})}
 // V37.1 coordinator finance/assets APIs.
 if(p==='/api/budget-transactions'&&method==='GET'&&['coordinator','owner'].includes(u.role)){
   const rows=u.role==='owner'?db.prepare('SELECT bt.*,i.name institution_name FROM budget_transactions bt LEFT JOIN institutions i ON i.id=bt.institution_id ORDER BY bt.transaction_date DESC,bt.created_at DESC').all():db.prepare('SELECT * FROM budget_transactions WHERE institution_id=? ORDER BY transaction_date DESC,created_at DESC').all(u.institution_id); return json(res,200,rows);
 }
 if(p==='/api/budget-transactions'&&method==='POST'&&['coordinator','owner'].includes(u.role)){
   const b=await body(req),inst=u.role==='owner'?b.institution_id:u.institution_id;if(!inst||!sameInst(u,inst))return deny(res);if(!['income','expense'].includes(b.transaction_type))return json(res,400,{error:'نوع العملية غير صحيح'});if(Number(b.amount)<=0)return json(res,400,{error:'المبلغ يجب أن يكون أكبر من صفر'});if(!String(b.reason||'').trim())return json(res,400,{error:'سبب العملية مطلوب'});const nid=id();db.prepare('INSERT INTO budget_transactions(id,institution_id,transaction_type,amount,reason,category,transaction_date,reference,beneficiary,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(nid,inst,b.transaction_type,Number(b.amount),b.reason,b.category||null,b.transaction_date||new Date().toISOString().slice(0,10),b.reference||null,b.beneficiary||null,b.notes||null,u.id);audit(u,'CREATE','budget_transaction',nid,b);return json(res,201,{id:nid});
 }
 if(p.startsWith('/api/budget-transactions/')&&method==='PUT'&&['coordinator','owner'].includes(u.role)){
   const id0=p.split('/').pop(),x=db.prepare('SELECT * FROM budget_transactions WHERE id=?').get(id0);if(!x)return json(res,404,{error:'العملية غير موجودة'});if(!sameInst(u,x.institution_id))return deny(res);const b=await body(req);db.prepare('UPDATE budget_transactions SET transaction_type=?,amount=?,reason=?,category=?,transaction_date=?,reference=?,beneficiary=?,notes=? WHERE id=?').run(b.transaction_type||x.transaction_type,Number(b.amount??x.amount),b.reason||x.reason,b.category??x.category,b.transaction_date??x.transaction_date,b.reference??x.reference,b.beneficiary??x.beneficiary,b.notes??x.notes,id0);audit(u,'UPDATE','budget_transaction',id0,b);return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/budget-transactions/')&&method==='DELETE'&&['coordinator','owner'].includes(u.role)){
   const id0=p.split('/').pop(),x=db.prepare('SELECT * FROM budget_transactions WHERE id=?').get(id0);if(!x)return json(res,404,{error:'العملية غير موجودة'});if(!sameInst(u,x.institution_id))return deny(res);db.prepare('DELETE FROM budget_transactions WHERE id=?').run(id0);audit(u,'DELETE','budget_transaction',id0,{});return json(res,200,{ok:true});
 }
 for(const kind of ['equipment_incidents','facility_incidents']){
   if(p===`/api/${kind}`&&method==='GET'&&['coordinator','owner'].includes(u.role)){const rows=u.role==='owner'?db.prepare(`SELECT x.*,i.name institution_name FROM ${kind} x LEFT JOIN institutions i ON i.id=x.institution_id ORDER BY x.incident_date DESC,x.created_at DESC`).all():db.prepare(`SELECT x.*,${kind==='equipment_incidents'?'e.name equipment_name':'f.name facility_name'} FROM ${kind} x LEFT JOIN ${kind==='equipment_incidents'?'equipment e':'facilities f'} ON ${kind==='equipment_incidents'?'e.id=x.equipment_id':'f.id=x.facility_id'} WHERE x.institution_id=? ORDER BY x.incident_date DESC,x.created_at DESC`).all(u.institution_id);return json(res,200,rows)}
   if(p===`/api/${kind}`&&method==='POST'&&['coordinator','owner'].includes(u.role)){const b=await body(req),inst=u.role==='owner'?b.institution_id:u.institution_id;if(!inst||!sameInst(u,inst))return deny(res);if(!b.incident_type||!b.description)return json(res,400,{error:'نوع التقرير والوصف مطلوبان'});const nid=id();if(kind==='equipment_incidents')db.prepare('INSERT INTO equipment_incidents(id,equipment_id,institution_id,incident_type,quantity,description,action_taken,incident_date,reported_by,created_by,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(nid,b.equipment_id||null,inst,b.incident_type,Number(b.quantity||1),b.description,b.action_taken||'',b.incident_date||new Date().toISOString().slice(0,10),b.reported_by||'',u.id,'open');else db.prepare('INSERT INTO facility_incidents(id,facility_id,institution_id,incident_type,description,action_taken,incident_date,reported_by,created_by,status) VALUES(?,?,?,?,?,?,?,?,?,?)').run(nid,b.facility_id||null,inst,b.incident_type,b.description,b.action_taken||'',b.incident_date||new Date().toISOString().slice(0,10),b.reported_by||'',u.id,'open');audit(u,'CREATE',kind,nid,b);return json(res,201,{id:nid})}
   if(p.startsWith(`/api/${kind}/`)&&method==='PATCH'&&['coordinator','owner'].includes(u.role)){const id0=p.split('/').pop(),x=db.prepare(`SELECT * FROM ${kind} WHERE id=?`).get(id0);if(!x)return json(res,404,{error:'التقرير غير موجود'});if(!sameInst(u,x.institution_id))return deny(res);const b=await body(req);db.prepare(`UPDATE ${kind} SET status=?,action_taken=? WHERE id=?`).run(b.status||x.status,b.action_taken??x.action_taken,id0);return json(res,200,{ok:true})}
 }
 // Full CRUD for coordinator inventory records.
 for(const type of ['equipment','facilities']){
   if(p.startsWith(`/api/${type}/`)&&method==='PUT'&&['coordinator','owner'].includes(u.role)){const id0=p.split('/').pop(),x=db.prepare(`SELECT * FROM ${type} WHERE id=?`).get(id0);if(!x)return json(res,404,{error:'السجل غير موجود'});if(!sameInst(u,x.institution_id))return deny(res);const b=await body(req);if(type==='equipment')db.prepare('UPDATE equipment SET name=?,category=?,quantity=?,condition=?,notes=? WHERE id=?').run(b.name??x.name,b.category??x.category,Number(b.quantity??x.quantity),b.condition??x.condition,b.notes??x.notes,id0);else db.prepare('UPDATE facilities SET name=?,type=?,capacity=?,notes=? WHERE id=?').run(b.name??x.name,b.type??x.type,b.capacity??x.capacity,b.notes??x.notes,id0);audit(u,'UPDATE',type,id0,b);return json(res,200,{ok:true})}
   if(p.startsWith(`/api/${type}/`)&&method==='DELETE'&&['coordinator','owner'].includes(u.role)){const id0=p.split('/').pop(),x=db.prepare(`SELECT * FROM ${type} WHERE id=?`).get(id0);if(!x)return json(res,404,{error:'السجل غير موجود'});if(!sameInst(u,x.institution_id))return deny(res);db.prepare(`DELETE FROM ${type} WHERE id=?`).run(id0);audit(u,'DELETE',type,id0,{});return json(res,200,{ok:true})}
 }
 // budget/equipment/facilities only coord/owner
 for(const type of ['budgets','equipment','facilities']){
  if(p===`/api/${type}`&&method==='GET'){if(!['coordinator','owner'].includes(u.role))return deny(res);return json(res,200,db.prepare(`SELECT * FROM ${type} WHERE ${u.role==='owner'?'1=1':'institution_id=?'} ORDER BY rowid DESC`).all(...(u.role==='owner'?[]:[u.institution_id])))}
  if(p===`/api/${type}`&&method==='POST'){if(!['coordinator','owner'].includes(u.role))return deny(res);const b=await body(req),inst=u.role==='owner'?b.institution_id:u.institution_id;if(!inst||!sameInst(u,inst))return deny(res);const nid=id();if(type==='budgets')db.prepare('INSERT INTO budgets VALUES(?,?,?,?,?,?)').run(nid,inst,b.label||'اعتماد سنوي',Number(b.amount||0),Number(b.spent||0),b.year_label||'2026-2027');if(type==='equipment')db.prepare('INSERT INTO equipment VALUES(?,?,?,?,?,?,?)').run(nid,inst,b.name,b.category||'',Number(b.quantity||0),b.condition||'good',b.notes||'');if(type==='facilities')db.prepare('INSERT INTO facilities VALUES(?,?,?,?,?,?)').run(nid,inst,b.name,b.type||'',b.capacity||'',b.notes||'');audit(u,'CREATE',type,nid,b);return json(res,201,{id:nid})}
  if(p.startsWith(`/api/${type}/`)&&method==='PUT'){if(!['coordinator','owner'].includes(u.role))return deny(res);const id0=p.split('/').pop(),x=db.prepare(`SELECT * FROM ${type} WHERE id=?`).get(id0);if(!x)return json(res,404,{error:'السجل غير موجود'});if(!sameInst(u,x.institution_id))return deny(res);const b=await body(req);if(type==='budgets')db.prepare('UPDATE budgets SET label=?,amount=?,spent=?,year_label=? WHERE id=?').run(b.label??x.label,Number(b.amount??x.amount),Number(b.spent??x.spent),b.year_label??x.year_label,id0);if(type==='equipment')db.prepare('UPDATE equipment SET name=?,category=?,quantity=?,condition=?,notes=? WHERE id=?').run(b.name??x.name,b.category??x.category,Number(b.quantity??x.quantity),b.condition??x.condition,b.notes??x.notes,id0);if(type==='facilities')db.prepare('UPDATE facilities SET name=?,type=?,capacity=?,notes=? WHERE id=?').run(b.name??x.name,b.type??x.type,b.capacity??x.capacity,b.notes??x.notes,id0);audit(u,'UPDATE',type,id0,b);return json(res,200,{ok:true})}
  if(p.startsWith(`/api/${type}/`)&&method==='DELETE'){if(!['coordinator','owner'].includes(u.role))return deny(res);const id0=p.split('/').pop(),x=db.prepare(`SELECT * FROM ${type} WHERE id=?`).get(id0);if(!x)return json(res,404,{error:'السجل غير موجود'});if(!sameInst(u,x.institution_id))return deny(res);db.prepare(`DELETE FROM ${type} WHERE id=?`).run(id0);audit(u,'DELETE',type,id0,{});return json(res,200,{ok:true})}
}
 if(p==='/api/support-alerts'&&method==='POST'){
   const b=await body(req); if(!b.subject||!b.body)return json(res,400,{error:'الموضوع والرسالة مطلوبان'});const sid=id();db.prepare('INSERT INTO support_alerts(id,sender_id,subject,body,status) VALUES(?,?,?,?,?)').run(sid,u.id,b.subject,b.body,'open');const owners=db.prepare("SELECT id FROM users WHERE role='owner' AND active=1").all();for(const o of owners)db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),o.id,'طلب مساعدة جديد',b.subject+' — '+b.body,'support',null,new Date().toISOString(),sid);audit(u,'CREATE','support_alert',sid,b);return json(res,201,{id:sid});
 }
 if(p==='/api/owner/alerts'&&method==='GET'&&u.role==='owner')return json(res,200,db.prepare(`SELECT a.*,u.full_name sender_name,u.role sender_role,i.name institution_name FROM support_alerts a JOIN users u ON u.id=a.sender_id LEFT JOIN institutions i ON i.id=u.institution_id ORDER BY CASE a.status WHEN 'open' THEN 0 ELSE 1 END,a.created_at DESC`).all());
 if(p.startsWith('/api/owner/alerts/')&&method==='PATCH'&&u.role==='owner'){const aid=p.split('/').pop(),b=await body(req);db.prepare('UPDATE support_alerts SET status=? WHERE id=?').run(b.status||'closed',aid);audit(u,'UPDATE','support_alert',aid,b);return json(res,200,{ok:true});}


 if(p==='/api/holidays'&&method==='POST'&&u.role==='teacher'){const b=await body(req);if(!b.label)return json(res,400,{error:'اسم العطلة مطلوب'});const hid=id();db.prepare('INSERT INTO holidays(id,institution_id,school_year,date,label,kind) VALUES(?,?,?,?,?,?)').run(hid,u.institution_id,b.school_year||'2026-2027',b.date||null,b.label,b.kind||'official');audit(u,'CREATE','holiday',hid,b);return json(res,201,{id:hid});}
 if(p.startsWith('/api/holidays/')&&method==='PUT'&&u.role==='teacher'){const hid=p.split('/').pop(),b=await body(req),x=db.prepare('SELECT * FROM holidays WHERE id=? AND institution_id=?').get(hid,u.institution_id);if(!x)return json(res,404,{error:'العطلة غير موجودة'});db.prepare('UPDATE holidays SET school_year=?,date=?,label=?,kind=? WHERE id=?').run(b.school_year??x.school_year,b.date??x.date,b.label??x.label,b.kind??x.kind,hid);audit(u,'UPDATE','holiday',hid,b);return json(res,200,{ok:true});}
 if(p.startsWith('/api/holidays/')&&method==='DELETE'&&u.role==='teacher'){const hid=p.split('/').pop();db.prepare('DELETE FROM holidays WHERE id=? AND institution_id=?').run(hid,u.institution_id);audit(u,'DELETE','holiday',hid,{});return json(res,200,{ok:true});}
 // Teacher v29: profile/document CRUD and richer student/assessment/report APIs
 if(p==='/api/teacher/profile'&&method==='PUT'&&u.role==='teacher'){
   const b=await body(req); const cur=db.prepare('SELECT * FROM teacher_profiles WHERE user_id=?').get(u.id);
   db.prepare(`INSERT INTO teacher_profiles(user_id,gender,dob,grade,specialization,payroll_number,seniority,photo_path,professional_summary)
     VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET gender=excluded.gender,dob=excluded.dob,grade=excluded.grade,specialization=excluded.specialization,payroll_number=excluded.payroll_number,seniority=excluded.seniority,photo_path=excluded.photo_path,professional_summary=excluded.professional_summary`)
     .run(u.id,(b.gender ?? cur?.gender ?? null),(b.dob ?? cur?.dob ?? null),(b.grade ?? cur?.grade ?? null),(b.specialization ?? cur?.specialization ?? null),(b.payroll_number ?? cur?.payroll_number ?? null),(b.seniority ?? cur?.seniority ?? null),(b.photo_path ?? cur?.photo_path ?? null),(b.professional_summary ?? cur?.professional_summary ?? null));
   audit(u,'UPDATE','teacher_profile',u.id,b); return json(res,200,{ok:true});
 }
 if(p==='/api/professional-documents'&&method==='POST'&&u.role==='teacher'){
   const b=await body(req); if(!b.title)return json(res,400,{error:'عنوان الوثيقة مطلوب'}); const did=id();
   db.prepare('INSERT INTO professional_documents(id,user_id,title,category,description,file_path) VALUES(?,?,?,?,?,?)').run(did,u.id,b.title,b.category||'Diplôme',b.description||'',b.file_path||''); audit(u,'CREATE','professional_document',did,b); return json(res,201,{id:did});
 }
 if(p.startsWith('/api/professional-documents/')&&method==='PUT'&&u.role==='teacher'){
   const did=p.split('/').pop(),b=await body(req); const x=db.prepare('SELECT * FROM professional_documents WHERE id=? AND user_id=?').get(did,u.id); if(!x)return json(res,404,{error:'الوثيقة غير موجودة'});
   db.prepare('UPDATE professional_documents SET title=?,category=?,description=?,file_path=? WHERE id=?').run(b.title??x.title,b.category??x.category,b.description??x.description,b.file_path??x.file_path,did); audit(u,'UPDATE','professional_document',did,b); return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/professional-documents/')&&method==='DELETE'&&u.role==='teacher'){
   const did=p.split('/').pop(); db.prepare('DELETE FROM professional_documents WHERE id=? AND user_id=?').run(did,u.id); audit(u,'DELETE','professional_document',did,{}); return json(res,200,{ok:true});
 }
 if(p==='/api/student-360'&&method==='GET'&&u.role==='teacher'){
   const sid=url.searchParams.get('student_id'); const st=db.prepare(`SELECT s.*,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.id); if(!st)return deny(res);
   const attendance=db.prepare(`SELECT d.status,COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE d.student_id=? AND se.teacher_id=? GROUP BY d.status`).all(sid,u.id);
   const results=db.prepare(`SELECT ar.score,ar.pro_score,ar.con_score,ar.remark,a.title,a.assessment_date,a.scale,a.criterion FROM assessment_results ar JOIN assessments a ON a.id=ar.assessment_id WHERE ar.student_id=? AND a.teacher_id=? ORDER BY a.assessment_date DESC`).all(sid,u.id);
   const sessions=db.prepare(`SELECT se.session_date,se.start_time,se.end_time,se.status,se.objective,se.reason FROM sessions se WHERE se.teacher_id=? AND se.class_id=? ORDER BY se.session_date DESC,se.start_time DESC LIMIT 100`).all(u.id,st.class_id);
   return json(res,200,{student:st,attendance,results,sessions});
 }
 if(p.startsWith('/api/plans/')&&p.endsWith('/assign')&&method==='POST'&&['coordinator','owner'].includes(u.role)){
   const parts=p.split('/').filter(Boolean),pid=parts[2],b=await body(req),x=db.prepare('SELECT * FROM annual_plans WHERE id=?').get(pid);
   if(!x)return json(res,404,{error:'الخطة غير موجودة'}); if(!sameInst(u,x.institution_id))return deny(res);
   const teacherId=String(b.teacher_id||'').trim(); if(!teacherId)return json(res,400,{error:'يجب اختيار أستاذ لإسناد التخطيط'});
   const teacher=db.prepare("SELECT id,full_name,institution_id,role,active FROM users WHERE id=? AND role='teacher'").get(teacherId);
   if(!teacher||teacher.institution_id!==x.institution_id)return json(res,400,{error:'الأستاذ المحدد غير تابع للمؤسسة نفسها'});
   db.prepare('UPDATE annual_plans SET teacher_id=? WHERE id=?').run(teacherId,pid);
   db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),teacherId,'تم إسناد التخطيط السنوي إليك',`تم إسناد «${x.title}» إليك من طرف المؤسسة.`, 'annual_plan_assigned',null,new Date().toISOString(),pid);
   audit(u,'ASSIGN','annual_plan',pid,{teacher_id:teacherId,teacher_name:teacher.full_name}); return json(res,200,{ok:true,assigned:true,teacher_id:teacherId,teacher_name:teacher.full_name});
 }
 if(p.startsWith('/api/plans/')&&method==='PUT'&&['coordinator','owner'].includes(u.role)){
   const pid=p.split('/').pop(),b=await body(req),x=db.prepare('SELECT * FROM annual_plans WHERE id=?').get(pid);
   if(!x)return json(res,404,{error:'الخطة غير موجودة'});
   if(!sameInst(u,x.institution_id))return deny(res);
   const teacherId=String(b.teacher_id??x.teacher_id??'').trim();
   if(!teacherId)return json(res,400,{error:'يجب إسناد التخطيط إلى أستاذ'});
   const teacher=db.prepare("SELECT id,full_name,institution_id,role,active FROM users WHERE id=? AND role='teacher'").get(teacherId);
   if(!teacher||teacher.institution_id!==x.institution_id)return json(res,400,{error:'الأستاذ المحدد غير تابع للمؤسسة نفسها'});
   const title=String((b.title??x.title) || 'التخطيط السنوي للتربية البدنية');
   const schoolYear=b.school_year??x.school_year;
   const status=b.status??x.status;
   db.prepare('UPDATE annual_plans SET title=?,school_year=?,status=?,teacher_id=? WHERE id=?').run(title,schoolYear,status,teacherId,pid);
   if(teacherId!==x.teacher_id){
     db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),teacherId,'تم إسناد التخطيط السنوي إليك',`تم إسناد «${title}» إليك. يمكنك الآن استعماله في الوحدات والحصص والجذاذات والتقويم. `,'annual_plan_assigned',null,new Date().toISOString(),pid);
   }
   audit(u,'UPDATE','annual_plan',pid,{...b,teacher_id:teacherId,assigned:true});
   return json(res,200,{ok:true,assigned:true,teacher_id:teacherId,teacher_name:teacher.full_name});
 }
 if(p.startsWith('/api/plans/')&&method==='DELETE'&&['coordinator','owner'].includes(u.role)){
   const pid=p.split('/').pop(),x=db.prepare('SELECT * FROM annual_plans WHERE id=?').get(pid); if(!x)return json(res,404,{error:'الخطة غير موجودة'}); if(u.role==='teacher'&&x.teacher_id!==u.id)return deny(res); if(u.role!=='teacher'&&!sameInst(u,x.institution_id))return deny(res); db.prepare('DELETE FROM units WHERE plan_id=?').run(pid); db.prepare('DELETE FROM annual_plans WHERE id=?').run(pid); audit(u,'DELETE','annual_plan',pid,{}); return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/units/')&&method==='PUT'&&['coordinator','owner'].includes(u.role)){
   const uid=p.split('/').pop(),b=await body(req),x=db.prepare('SELECT un.*,p.institution_id,p.teacher_id FROM units un JOIN annual_plans p ON p.id=un.plan_id WHERE un.id=?').get(uid); if(!x||x.teacher_id!==u.id)return deny(res);
   db.prepare('UPDATE units SET plan_id=?,class_id=?,sport=?,title=?,session_count=?,duration_minutes=?,objective=?,cycle=?,start_date=?,end_date=? WHERE id=?').run(b.plan_id??x.plan_id,b.class_id??x.class_id,b.sport??x.sport,b.title??x.title,Number(b.session_count ?? x.session_count ?? 10),Number(b.duration_minutes ?? x.duration_minutes ?? 60),b.objective??x.objective,Number(b.cycle ?? x.cycle ?? 1),b.start_date??x.start_date,b.end_date??x.end_date,uid); audit(u,'UPDATE','unit',uid,b); return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/units/')&&method==='DELETE'&&['coordinator','owner'].includes(u.role)){
   const uid=p.split('/').pop(),x=db.prepare('SELECT un.id,p.teacher_id FROM units un JOIN annual_plans p ON p.id=un.plan_id WHERE un.id=?').get(uid); if(!x||x.teacher_id!==u.id)return deny(res); db.prepare('DELETE FROM units WHERE id=?').run(uid); audit(u,'DELETE','unit',uid,{}); return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/assessments/')&&method==='DELETE'&&u.role==='teacher'){
   const aid=p.split('/').pop(),x=db.prepare('SELECT * FROM assessments WHERE id=? AND teacher_id=?').get(aid,u.id); if(!x)return json(res,404,{error:'التقويم غير موجود'}); db.prepare('DELETE FROM assessment_results WHERE assessment_id=?').run(aid); db.prepare('DELETE FROM assessments WHERE id=?').run(aid); audit(u,'DELETE','assessment',aid,{}); return json(res,200,{ok:true});
 }
 if(p==='/api/assessment-results'&&method==='GET'&&u.role==='teacher'){
   const aid=url.searchParams.get('assessment_id'); const rows=db.prepare(`SELECT ar.*,s.first_name,s.last_name,s.massar_number FROM assessment_results ar JOIN students s ON s.id=ar.student_id JOIN assessments a ON a.id=ar.assessment_id WHERE a.teacher_id=? ${aid?'AND ar.assessment_id=?':''} ORDER BY s.last_name,s.first_name`).all(...(aid?[u.id,aid]:[u.id])); return json(res,200,rows);
 }
 if(p==='/api/teacher/report-data'&&method==='GET'&&u.role==='teacher'){
   const cid=url.searchParams.get('class_id'); const sid=url.searchParams.get('student_id');
   if(sid){ const r=db.prepare(`SELECT s.id,s.first_name,s.last_name,s.massar_number,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.id,u.id); if(!r)return deny(res); return json(res,200,{kind:'student',student:r}); }
   const classes=db.prepare('SELECT id,name FROM classes WHERE teacher_id=? ORDER BY name').all(u.id); if(cid && !classes.some(x=>x.id===cid))return deny(res); return json(res,200,{kind:'class',classes,selected:cid||null});
 }
 if(p==='/api/notifications'&&method==='GET')return json(res,200,db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC').all(u.id));
 if(p.startsWith('/api/notifications/')&&method==='PATCH'){const nid=p.split('/').pop();db.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').run(new Date().toISOString(),nid,u.id);return json(res,200,{ok:true})}
 if(p==='/api/teacher/message-targets'&&method==='GET'&&u?.role==='teacher')return json(res,200,db.prepare("SELECT u.id,u.full_name,u.role,i.name institution_name FROM users u LEFT JOIN institutions i ON i.id=u.institution_id WHERE u.active=1 AND u.institution_id=? AND u.role IN ('coordinator','inspector') ORDER BY u.role,u.full_name").all(u.institution_id));
 if(p==='/api/messages'&&method==='GET')return json(res,200,db.prepare('SELECT m.*,s.full_name sender_name,r.full_name recipient_name,i.name institution_name FROM messages m JOIN users s ON s.id=m.sender_id JOIN users r ON r.id=m.recipient_id LEFT JOIN institutions i ON i.id=r.institution_id WHERE m.sender_id=? OR m.recipient_id=? ORDER BY m.created_at DESC').all(u.id,u.id));
 if(p==='/api/messages'&&method==='POST'){const b=await body(req),r=db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(b.recipient_id);if(!r)return json(res,404,{error:'المستخدم غير موجود'});if(u.role==='owner'&&!['teacher','coordinator'].includes(r.role))return deny(res,'مالك المنصة يراسل المنسقين والأساتذة فقط');if(u.role!=='owner'&&r.role==='teacher'&&r.institution_id!==u.institution_id&&u.role!=='inspector')return deny(res,'المراسلة خارج النطاق غير مسموحة');const mid=id(),num='EPS-MSG-'+new Date().getFullYear()+'-'+String(Date.now()).slice(-8)+'-'+crypto.randomBytes(2).toString('hex').toUpperCase();db.prepare('INSERT INTO messages(id,sender_id,recipient_id,subject,body,read_at,created_at,message_number) VALUES(?,?,?,?,?,?,?,?)').run(mid,u.id,r.id,b.subject||'',b.body||'',null,new Date().toISOString(),num);db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),r.id,b.subject||'رسالة جديدة',b.body||'','message',null,new Date().toISOString(),mid);audit(u,'SEND','message',mid,{message_number:num,recipient_id:r.id});return json(res,201,{id:mid,message_number:num})}
 if(p==='/api/audit'&&method==='GET'){if(u.role!=='owner')return deny(res);return json(res,200,db.prepare('SELECT a.*,u.full_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200').all())}
 if(p==='/api/references'&&method==='GET'){if(u.role!=='owner')return deny(res);return json(res,200,[{title:'Orientations pédagogiques 2007',file:'docs/OP_2007_Fr.pdf'},{title:'Orientations pédagogiques 2009',file:'docs/OP_2009_Fr.pdf'},{title:'Barèmes extraits des OP',note:'Référentiel structuré à partir des documents officiels fournis'}])}

 // Secure teacher controls for one-time student self-fill links.
 if(p.startsWith('/api/teacher/students/')&&p.endsWith('/intake-link')&&method==='POST'&&u?.role==='teacher'){
   const sid=p.split('/')[4];
   const st=db.prepare(`SELECT s.id,c.institution_id,c.teacher_id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.institution_id,u.id,u.id);
   if(!st)return deny(res);
   db.prepare('UPDATE student_intake_links SET active=0 WHERE student_id=? AND active=1').run(sid);
   const raw=crypto.randomBytes(32).toString('base64url'),th=crypto.createHash('sha256').update(raw).digest('hex'),lid=id(),expires=new Date(Date.now()+7*24*60*60*1000).toISOString();
   db.prepare('INSERT INTO student_intake_links(id,student_id,token_hash,active,expires_at,created_at) VALUES(?,?,?,?,?,?)').run(lid,sid,th,1,expires,new Date().toISOString());
   audit(u,'CREATE','student_intake_link',sid,{expires_at:expires});
   const base=`http://${req.headers.host||'localhost'}`; return json(res,201,{url:`${base}/?student_token=${encodeURIComponent(raw)}`,expires_at:expires});
 }
 if(p.startsWith('/api/teacher/students/')&&p.endsWith('/intake-link')&&method==='DELETE'&&u?.role==='teacher'){
   const sid=p.split('/')[4];
   const st=db.prepare(`SELECT s.id,c.institution_id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.institution_id,u.id,u.id);
   if(!st)return deny(res); db.prepare('UPDATE student_intake_links SET active=0 WHERE student_id=?').run(sid); return json(res,200,{ok:true});
 }
 // ===== V30 teacher APIs =====
 if(p.startsWith('/api/students/')&&method==='PUT'&&u.role==='teacher'){
   const sid=p.split('/').pop(),b=await body(req); const st=db.prepare(`SELECT s.*,c.teacher_id,c.institution_id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.institution_id,u.id,u.id); if(!st)return deny(res);
   const targetId=b.class_id||st.class_id; const target=db.prepare('SELECT * FROM classes WHERE id=? AND institution_id=?').get(targetId,u.institution_id); if(!target)return deny(res,'القسم المستهدف غير موجود'); const targetAccess=target.teacher_id===u.id||db.prepare('SELECT 1 FROM timetable WHERE class_id=? AND teacher_id=?').get(targetId,u.id); if(!targetAccess)return deny(res,'لا يمكنك نقل التلميذ إلى هذا القسم');
   if(b.massar_number&&b.massar_number!==st.massar_number&&db.prepare('SELECT id FROM students WHERE massar_number=? AND id<>?').get(b.massar_number,sid))return json(res,409,{error:'رقم مسار موجود مسبقاً'});
   db.prepare('UPDATE students SET class_id=?,massar_number=?,first_name=?,last_name=?,dob=?,gender=?,birth_place=?,photo_path=?,eps_note=?,health_note=?,health_profile_json=?,profile_json=? WHERE id=?').run(targetId,b.massar_number??st.massar_number,b.first_name??st.first_name,b.last_name??st.last_name,b.dob??st.dob,b.gender??st.gender,b.birth_place??st.birth_place,b.photo_path??st.photo_path,b.eps_note??st.eps_note,b.health_note??st.health_note,b.health_profile_json??st.health_profile_json,b.profile_json??st.profile_json,sid); audit(u,targetId!==st.class_id?'MOVE':'UPDATE','student',sid,{...b,from_class_id:st.class_id,to_class_id:targetId}); return json(res,200,{ok:true,class_id:targetId});
 }
 if(p.startsWith('/api/students/')&&method==='DELETE'&&u.role==='teacher'){
   const sid=p.split('/').pop(),st=db.prepare(`SELECT s.id,c.teacher_id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.id); if(!st)return deny(res); db.prepare('DELETE FROM assessment_behavior WHERE student_id=?').run(sid); db.prepare('DELETE FROM assessment_results WHERE student_id=?').run(sid); db.prepare('DELETE FROM daily_entries WHERE student_id=?').run(sid); db.prepare('DELETE FROM students WHERE id=?').run(sid); audit(u,'DELETE','student',sid,{}); return json(res,200,{ok:true});
 }

 if(p==='/api/teacher/intelligence'&&method==='GET'&&u.role==='teacher'){
   const ilang=new URL(req.url,'http://localhost').searchParams.get('lang')||locale(req); const isAr=ilang==='ar', isFr=ilang==='fr';
   const classes=db.prepare(`SELECT c.id,c.name,COUNT(s.id) students FROM classes c LEFT JOIN students s ON s.class_id=c.id WHERE c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?)) GROUP BY c.id,c.name ORDER BY c.name`).all(u.institution_id,u.id,u.id);
   const ids=classes.map(x=>x.id); if(!ids.length)return json(res,200,{generated_by:'EPS PILOT local intelligence',summary:{classes:0,students:0,average:null,absences:0},insights:[{level:'info',title:isAr?'لا توجد معطيات كافية':isFr?'Données insuffisantes':'Not enough data',text:isAr?'أضف أو أسند قسماً للأستاذ ثم ابدأ التتبع.':isFr?'Ajoutez ou affectez une classe puis commencez le suivi.':'Add or assign a class, then start tracking.'}]});
   const ph=ids.map(()=>'?').join(',');
   const students=db.prepare(`SELECT COUNT(*) c FROM students WHERE class_id IN (${ph})`).get(...ids).c;
   const average=db.prepare(`SELECT AVG(ar.score) avg FROM assessment_results ar JOIN assessments a ON a.id=ar.assessment_id WHERE a.teacher_id=? AND a.class_id IN (${ph})`).get(u.id,...ids).avg;
   const absences=db.prepare(`SELECT COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE se.teacher_id=? AND se.class_id IN (${ph}) AND d.status='absent'`).get(u.id,...ids).c;
   const completed=db.prepare(`SELECT COUNT(*) c FROM sessions WHERE teacher_id=? AND class_id IN (${ph}) AND status='completed'`).get(u.id,...ids).c;
   const total=db.prepare(`SELECT COUNT(*) c FROM sessions WHERE teacher_id=? AND class_id IN (${ph})`).get(u.id,...ids).c;
   const insights=[];
   if(average!=null && Number(average)<10) insights.push({level:'warn',title:isAr?'مؤشر تعلمي':isFr?'Indicateur d’apprentissage':'Learning indicator',text:isAr?`متوسط التقويم الحالي ${Number(average).toFixed(2)}/20. يوصى بإعادة استثمار الصعوبات في الحصص المقبلة.`:isFr?`Moyenne actuelle ${Number(average).toFixed(2)}/20. Il est conseillé de retravailler les difficultés dans les prochaines séances.`:`Current assessment average is ${Number(average).toFixed(2)}/20. Consider targeted reinforcement in upcoming sessions.`});
   if(absences>0) insights.push({level:absences>students?'warn':'info',title:isAr?'مؤشر الحضور':isFr?'Indicateur de présence':'Attendance indicator',text:isAr?`تم تسجيل ${absences} حالة غياب ضمن المعطيات المتاحة. راقب الأقسام ذات الغياب المتكرر.`:isFr?`${absences} absences sont enregistrées dans les données disponibles. Surveillez les absences répétées.`:`${absences} absences are recorded in the available data. Monitor repeated absences.`});
   if(total && completed/total<0.75) insights.push({level:'warn',title:isAr?'إنجاز البرنامج':isFr?'Réalisation du programme':'Programme delivery',text:isAr?`تم إنجاز ${completed} من أصل ${total} حصة مسجلة. راجع الحصص غير المنجزة وأسبابها.`:isFr?`${completed} séances sur ${total} sont réalisées. Vérifiez les séances non réalisées et leurs motifs.`:`${completed} of ${total} recorded sessions are completed. Review missed sessions and reasons.`});
   if(!insights.length)insights.push({level:'good',title:isAr?'المؤشرات مستقرة':isFr?'Indicateurs stables':'Indicators stable',text:isAr?'لا يظهر حالياً مؤشر قوي يستدعي تدخلاً عاجلاً ضمن المعطيات المتوفرة.':isFr?'Aucun indicateur fort ne nécessite actuellement une intervention urgente.':'No strong indicator currently requires urgent intervention.'});
   return json(res,200,{generated_by:'EPS PILOT local intelligence',summary:{classes:classes.length,students,average:average==null?null:Number(average).toFixed(2),absences},classes,insights});
 }
 if(p==='/api/teacher/intelligence/session'&&method==='POST'&&u.role==='teacher'){
   const b=await body(req),sport=String(b.sport||'').trim(),level=String(b.level||'').trim(),need=String(b.need||'').trim(),slang=b.lang||locale(req),sar=slang==='ar',sfr=slang==='fr'; if(!sport||!level)return json(res,400,{error:'النشاط والمستوى مطلوبان'});
   let objective;
   if(sar){ objective=need.includes('تحمل')?`تنمية التحمل البدني لدى تلاميذ ${level} من خلال وضعيات متدرجة في ${sport}.`:need.includes('تعاون')?`تنمية التعاون والتنظيم الجماعي لدى تلاميذ ${level} عبر وضعيات تطبيقية في ${sport}.`:`تحسين الأداء التقني لدى تلاميذ ${level} في ${sport} من خلال وضعيات بسيطة ومتدرجة.`; }
   else if(sfr){ objective=need.toLowerCase().includes('endurance')?`Développer l’endurance des élèves de ${level} à travers des situations progressives en ${sport}.`:need.toLowerCase().includes('cooperation')?`Développer la coopération et l’organisation collective des élèves de ${level} à travers des situations en ${sport}.`:`Améliorer la performance technique des élèves de ${level} en ${sport} grâce à des situations simples et progressives.`; }
   else { objective=`Develop ${level} students’ performance through progressive ${sport} situations.`; }
   const stages=sar?[{name:'الإحماء',text:'نشاط عام ثم حركات مرتبطة بمتطلبات النشاط مع رفع تدريجي للشدة.'},{name:'التعلم والتجريب',text:'وضعية تعلمية قصيرة، شرح المعيار، ثم تكرارات مع ملاحظات فردية.'},{name:'التطبيق',text:'وضعية مركبة تسمح بالتكرار والتدرج مع تنظيم آمن للمجموعات.'},{name:'التقويم والتهدئة',text:'تقويم سريع لمعيار النجاح، ثم عودة هادئة واسترجاع الملاحظات الأساسية.'}]:sfr?[{name:'Échauffement',text:'Activité générale puis mouvements liés à l’APS avec montée progressive de l’intensité.'},{name:'Apprentissage',text:'Situation courte, explicitation du critère puis répétitions avec feedback.'},{name:'Application',text:'Situation complexe permettant répétition, progression et organisation sûre.'},{name:'Évaluation',text:'Évaluation rapide du critère de réussite puis retour au calme.'}]:[{name:'Warm-up',text:'General activity followed by APS-specific movements with progressive intensity.'},{name:'Learning',text:'Short learning task, criterion explanation, repetitions and feedback.'},{name:'Application',text:'A progressive complex task with safe group organisation.'},{name:'Review',text:'Quick success-criterion check followed by cool-down and key feedback.'}];
   audit(u,'AI_GENERATE','session_suggestion',u.id,{sport,level,need}); return json(res,200,{generated_by:'EPS PILOT local intelligence',title:`${sport} · ${level}`,objective,stages});
 }
 if(p==='/api/teacher/ai-report'&&method==='POST'&&u.role==='teacher'){
   const b=await body(req),scope=b.scope||'teacher',cid=b.class_id||null,sid=b.student_id||null;
   if(sid){const st=db.prepare(`SELECT s.*,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.id,u.id);if(!st)return deny(res);const att=db.prepare(`SELECT d.status,COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE d.student_id=? AND se.teacher_id=? GROUP BY d.status`).all(sid,u.id);const rs=db.prepare(`SELECT AVG(ar.score) avg,COUNT(*) n FROM assessment_results ar JOIN assessments a ON a.id=ar.assessment_id WHERE ar.student_id=? AND a.teacher_id=?`).get(sid,u.id);const completed=db.prepare(`SELECT COUNT(*) c FROM sessions WHERE teacher_id=? AND class_id=? AND status='completed'`).get(u.id,st.class_id).c;const total=db.prepare(`SELECT COUNT(*) c FROM sessions WHERE teacher_id=? AND class_id=?`).get(u.id,st.class_id).c;const avg=rs?.avg==null?null:Number(rs.avg);const present=(att.find(x=>x.status==='present')?.c||0),absent=(att.find(x=>x.status==='absent')?.c||0);const parts=[];parts.push(`التلميذ ${st.first_name||''} ${st.last_name||''} (${st.massar_number})`);parts.push(avg==null?'لا توجد نقط كافية بعد.':`متوسط التقويم ${avg.toFixed(2)} / 20.`);parts.push(`الحضور: ${present}، الغياب: ${absent}.`);parts.push(`إنجاز حصص القسم: ${completed}/${total}.`);if(absent>present&&absent>0)parts.push('مؤشر يحتاج الانتباه: الغياب مرتفع مقارنة بالحضور.');if(avg!=null&&avg<10)parts.push('مؤشر تعلمي: النتائج الحالية أقل من 10/20؛ يوصى بتتبع الصعوبات وإعادة الاستثمار في الحصص المقبلة.');if(avg!=null&&avg>=14)parts.push('مؤشر إيجابي: الأداء التقويمي جيد حالياً.');return json(res,200,{kind:'student',generated_by:'EPS PILOT local analytics',text:parts.join(' ')})}
   let where='c.teacher_id=?',args=[u.id];if(cid){where+=' AND c.id=?';args.push(cid)}const classes=db.prepare(`SELECT c.id,c.name,COUNT(s.id) students FROM classes c LEFT JOIN students s ON s.class_id=c.id WHERE ${where} GROUP BY c.id,c.name ORDER BY c.name`).all(...args);const classIds=classes.map(x=>x.id);if(!classIds.length)return json(res,200,{kind:'class',text:'لا توجد معطيات كافية لتحليل القسم.'});const ph=classIds.map(()=>'?').join(',');const ss=db.prepare(`SELECT COUNT(*) c FROM sessions se WHERE se.teacher_id=? AND se.class_id IN (${ph}) AND se.status='completed'`).get(u.id,...classIds).c;const stCount=db.prepare(`SELECT COUNT(*) c FROM students s WHERE s.class_id IN (${ph})`).get(...classIds).c;const avg=db.prepare(`SELECT AVG(ar.score) avg FROM assessment_results ar JOIN assessments a ON a.id=ar.assessment_id JOIN students s ON s.id=ar.student_id WHERE a.teacher_id=? AND s.class_id IN (${ph})`).get(u.id,...classIds).avg;const absent=db.prepare(`SELECT COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE se.teacher_id=? AND d.status='absent' AND se.class_id IN (${ph})`).get(u.id,...classIds).c;const text=`تحليل القسم: ${classes.length} قسم، ${stCount} تلميذ، ${ss} حصة منجزة، متوسط التقويم ${avg==null?'غير متوفر':Number(avg).toFixed(2)+'/20'}، ${absent} حالة غياب. ${absent>stCount?'ينصح بتتبع الحضور.':'مؤشر الحضور قابل للتتبع بشكل عادي.'}`;return json(res,200,{kind:'class',text,generated_by:'EPS PILOT local analytics',classes});
 }
 if(p==='/api/teacher/report'&&method==='GET'&&u.role==='teacher'){
   const q=new URL(req.url,'http://localhost').searchParams,cid=q.get('class_id')||null,sid=q.get('student_id')||null,unitId=q.get('unit_id')||null,from=q.get('from')||'2026-09-01',to=q.get('to')||'2027-07-31',period=q.get('period')||'all';
   const scopeClass=cid?db.prepare('SELECT * FROM classes WHERE id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable WHERE class_id=? AND teacher_id=?))').get(cid,u.id,cid,u.id):null; if(cid&&!scopeClass)return deny(res);
   let classes=cid?[scopeClass]:db.prepare('SELECT c.* FROM classes c WHERE c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?)) ORDER BY c.name').all(u.institution_id,u.id,u.id);
   const ids=classes.map(x=>x.id); if(!ids.length)return json(res,200,{classes:[],students:[],sessions:[],attendance:[],assessments:[],behavior:[],summary:{}}); const ph=ids.map(()=>'?').join(',');
   const students=sid?db.prepare(`SELECT s.id,s.class_id,s.massar_number,s.first_name,s.last_name,s.dob,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND s.class_id IN (${ph})`).all(sid,...ids):db.prepare(`SELECT s.id,s.class_id,s.massar_number,s.first_name,s.last_name,s.dob,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.class_id IN (${ph}) ORDER BY c.name,s.last_name,s.first_name`).all(...ids);
   if(sid&&!students.length)return deny(res);
   const sfilter=sid?' AND se.student_id=?':''; const sargs=sid?[...ids,sid]:ids;
   const sessions=db.prepare(`SELECT se.id,se.class_id,se.session_date,se.start_time,se.end_time,se.status,se.objective,se.reason,se.unit_id,u.sport,u.title unit_title FROM sessions se LEFT JOIN units u ON u.id=se.unit_id WHERE se.teacher_id=? AND se.class_id IN (${ph}) AND se.session_date BETWEEN ? AND ? ${cid?'':''} ORDER BY se.session_date,se.start_time`).all(u.id,...ids,from,to);
   const attendance=db.prepare(`SELECT d.student_id,d.status,COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE se.teacher_id=? AND se.class_id IN (${ph}) AND se.session_date BETWEEN ? AND ? GROUP BY d.student_id,d.status`).all(u.id,...ids,from,to);
   const assessments=db.prepare(`SELECT a.id,a.class_id,a.unit_id,a.title,a.assessment_date,a.scale,a.criterion,AVG(ar.score) avg,COUNT(ar.id) entries FROM assessments a LEFT JOIN assessment_results ar ON ar.assessment_id=a.id WHERE a.teacher_id=? AND a.class_id IN (${ph}) AND a.assessment_date BETWEEN ? AND ? GROUP BY a.id ORDER BY a.assessment_date`).all(u.id,...ids,from,to);
   const behavior=db.prepare(`SELECT ab.assessment_id,ab.student_id,ab.base_score,ab.deduction,ab.final_score,a.assessment_date,a.title FROM assessment_behavior ab JOIN assessments a ON a.id=ab.assessment_id WHERE a.teacher_id=? AND a.class_id IN (${ph}) AND a.assessment_date BETWEEN ? AND ?`).all(u.id,...ids,from,to);
   const resultRows=db.prepare(`SELECT ar.student_id,a.title,a.assessment_date,a.scale,ar.score,a.criterion,a.unit_id FROM assessment_results ar JOIN assessments a ON a.id=ar.assessment_id WHERE a.teacher_id=? AND a.class_id IN (${ph}) AND a.assessment_date BETWEEN ? AND ? ORDER BY a.assessment_date`).all(u.id,...ids,from,to);
   const byStudent={}; for(const x of students)byStudent[x.id]={...x,attendance:{},results:[],behavior:[]}; for(const x of attendance)if(byStudent[x.student_id])byStudent[x.student_id].attendance[x.status]=x.c; for(const x of resultRows)if(byStudent[x.student_id])byStudent[x.student_id].results.push(x); for(const x of behavior)if(byStudent[x.student_id])byStudent[x.student_id].behavior.push(x);
   const totalSessions=sessions.length,completed=sessions.filter(x=>x.status==='completed').length,notHeld=sessions.filter(x=>x.status==='not_held'||x.status==='needs_reason').length;
   const attSummary={}; attendance.forEach(x=>attSummary[x.status]=(attSummary[x.status]||0)+x.c); const avgAssess=assessments.filter(x=>x.avg!=null).length?assessments.filter(x=>x.avg!=null).reduce((a,x)=>a+Number(x.avg),0)/assessments.filter(x=>x.avg!=null).length:null;
   const weekly={}; for(const se of sessions){const d=new Date(se.session_date+'T00:00:00'); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); const k=d.toISOString().slice(0,10); if(!weekly[k])weekly[k]={week:k,sessions:0,completed:0,notHeld:0}; weekly[k].sessions++; if(se.status==='completed')weekly[k].completed++; if(se.status==='not_held'||se.status==='needs_reason')weekly[k].notHeld++;}
   let units=db.prepare(`SELECT id,title,sport,session_count,duration_minutes FROM units WHERE class_id IN (${ph}) ORDER BY created_at`).all(...ids); if(unitId)units=units.filter(x=>x.id===unitId);
   const summary={students:students.length,sessions:totalSessions,completed,notHeld,attendance:attSummary,assessmentAverage:avgAssess,weekly:Object.values(weekly),units};
   return json(res,200,{period,from,to,classes,students:Object.values(byStudent),sessions,attendance,assessments,behavior,summary});
 }
 if(p==='/api/teacher/class-report'&&method==='GET'&&u.role==='teacher'){
   const cid=url.searchParams.get('class_id'),c=db.prepare('SELECT * FROM classes WHERE id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable WHERE class_id=? AND teacher_id=?))').get(cid,u.id,cid,u.id);if(!c)return deny(res);const students=db.prepare('SELECT id,massar_number,first_name,last_name FROM students WHERE class_id=? ORDER BY last_name,first_name').all(cid);const sessions=db.prepare('SELECT session_date,start_time,end_time,status,objective,reason FROM sessions WHERE class_id=? AND teacher_id=? ORDER BY session_date,start_time').all(cid,u.id);const assessments=db.prepare('SELECT a.id,a.title,a.assessment_date,a.scale,a.criterion,AVG(ar.score) avg FROM assessments a LEFT JOIN assessment_results ar ON ar.assessment_id=a.id WHERE a.class_id=? AND a.teacher_id=? GROUP BY a.id ORDER BY a.assessment_date').all(cid,u.id);const behavior=db.prepare(`SELECT ab.*,s.first_name,s.last_name FROM assessment_behavior ab JOIN assessment_results ar ON ar.assessment_id=ab.assessment_id AND ar.student_id=ab.student_id JOIN students s ON s.id=ab.student_id JOIN assessments a ON a.id=ab.assessment_id WHERE a.class_id=? AND a.teacher_id=? ORDER BY a.assessment_date DESC`).all(cid,u.id);return json(res,200,{class:c,students,sessions,assessments,behavior});
 }
 if(p==='/api/teacher/student-report'&&method==='GET'&&u.role==='teacher'){
   const sid=url.searchParams.get('student_id'),st=db.prepare(`SELECT s.*,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.id,u.id);if(!st)return deny(res);const att=db.prepare(`SELECT d.status,COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE d.student_id=? AND se.teacher_id=? GROUP BY d.status`).all(sid,u.id);const results=db.prepare(`SELECT ar.score,ar.pro_score,ar.con_score,ar.remark,a.title,a.assessment_date,a.scale,a.criterion FROM assessment_results ar JOIN assessments a ON a.id=ar.assessment_id WHERE ar.student_id=? AND a.teacher_id=? ORDER BY a.assessment_date`).all(sid,u.id);const beh=db.prepare(`SELECT ab.*,a.title,a.assessment_date FROM assessment_behavior ab JOIN assessments a ON a.id=ab.assessment_id WHERE ab.student_id=? AND a.teacher_id=? ORDER BY a.assessment_date`).all(sid,u.id);const sess=db.prepare('SELECT session_date,start_time,end_time,status,objective,reason FROM sessions WHERE class_id=? AND teacher_id=? ORDER BY session_date,start_time').all(st.class_id,u.id);return json(res,200,{student:st,attendance:att,results,behavior:beh,sessions:sess});
 }
 if(p==='/api/assessment-behavior'&&method==='POST'&&u.role==='teacher'){
   const b=await body(req),a=db.prepare('SELECT * FROM assessments WHERE id=? AND teacher_id=?').get(b.assessment_id,u.id),st=db.prepare('SELECT s.* FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))').get(b.student_id,u.id);if(!a||!st)return deny(res);const base=Number(b.base_score||0),ded=Number(b.deduction||0),fin=Math.max(0,base-ded);db.prepare(`INSERT INTO assessment_behavior(id,assessment_id,student_id,base_score,deduction,final_score,remark) VALUES(?,?,?,?,?,?,?) ON CONFLICT(assessment_id,student_id) DO UPDATE SET base_score=excluded.base_score,deduction=excluded.deduction,final_score=excluded.final_score,remark=excluded.remark`).run(id(),a.id,st.id,base,ded,fin,b.remark||null);return json(res,200,{ok:true,final_score:fin});
 }
 if(p==='/api/assessment-behavior'&&method==='GET'&&u.role==='teacher'){
   const aid=url.searchParams.get('assessment_id');return json(res,200,db.prepare(`SELECT ab.*,s.first_name,s.last_name,s.massar_number FROM assessment_behavior ab JOIN students s ON s.id=ab.student_id JOIN assessments a ON a.id=ab.assessment_id WHERE a.teacher_id=? ${aid?'AND a.id=?':''} ORDER BY s.last_name,s.first_name`).all(...(aid?[u.id,aid]:[u.id])));
 }
 if(p==='/api/professional-years'&&method==='GET'&&u.role==='teacher')return json(res,200,db.prepare('SELECT * FROM professional_years WHERE user_id=? ORDER BY school_year DESC').all(u.id));
 if(p==='/api/professional-years'&&method==='POST'&&u.role==='teacher'){const b=await body(req),rid=id();db.prepare('INSERT INTO professional_years(id,user_id,school_year,grade,specialization,seniority,institution_name,position_note) VALUES(?,?,?,?,?,?,?,?)').run(rid,u.id,b.school_year,b.grade||null,b.specialization||null,b.seniority||null,b.institution_name||null,b.position_note||null);return json(res,201,{id:rid});}
 if(p.startsWith('/api/professional-years/')&&method==='PUT'&&u.role==='teacher'){const rid=p.split('/').pop(),b=await body(req);db.prepare('UPDATE professional_years SET school_year=?,grade=?,specialization=?,seniority=?,institution_name=?,position_note=? WHERE id=? AND user_id=?').run(b.school_year,b.grade||null,b.specialization||null,b.seniority||null,b.institution_name||null,b.position_note||null,rid,u.id);return json(res,200,{ok:true});}
 if(p.startsWith('/api/professional-years/')&&method==='DELETE'&&u.role==='teacher'){const rid=p.split('/').pop();db.prepare('DELETE FROM professional_years WHERE id=? AND user_id=?').run(rid,u.id);return json(res,200,{ok:true});}

 // V36.4 — Teacher readiness: one source of truth for first-start and missing prerequisites.
 if(p==='/api/teacher/setup-status'&&method==='GET'&&u.role==='teacher'){
   const classes=db.prepare('SELECT COUNT(*) c FROM classes WHERE institution_id=? AND active=1 AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))').get(u.institution_id,u.id,u.id).c;
   const timetable=db.prepare('SELECT COUNT(*) c FROM timetable WHERE institution_id=? AND teacher_id=?').get(u.institution_id,u.id).c;
   const refRows=db.prepare('SELECT key FROM platform_reference_data WHERE institution_id=?').all(u.institution_id);
   const refKeys=new Set(refRows.map(x=>x.key));
   const holidays=db.prepare('SELECT COUNT(*) c FROM holidays WHERE institution_id=?').get(u.institution_id).c;
   const docs=db.prepare("SELECT COUNT(*) c FROM resource_documents WHERE institution_id=? AND active=1 AND category='pedagogy'").get(u.institution_id).c;
   const items=[
    {key:'classes',label:'الأقسام واللوائح',ready:classes>0,action:'classes',reason:classes>0?'تم توفير الأقسام المرتبطة بفضاء الأستاذ.':'لم تتم إضافة أو إسناد أي قسم بعد.'},
    {key:'timetable',label:'استعمال الزمن',ready:timetable>0,action:'timetable',reason:timetable>0?'تم توفير استعمال الزمن.':'لم يتم توفير استعمال الزمن بعد.'},
    {key:'grading',label:'شبكة التنقيط والتقويم',ready:refKeys.has('grading'),action:'grading',reason:refKeys.has('grading')?'تم إعداد شبكة التنقيط.':'لم يتم إعداد شبكة التنقيط بعد.'},
    {key:'holidays',label:'لائحة العطل',ready:holidays>0,action:'holidays',reason:holidays>0?'تمت إضافة لائحة العطل.':'لم تتم إضافة لائحة العطل بعد.'},
    {key:'pedagogy',label:'التوجيهات والمراجع التربوية',ready:docs>0,action:'pedagogy',reason:docs>0?'تم توفير مراجع تربوية.':'لم تتم إضافة المراجع التربوية بعد.'}
   ];
   return json(res,200,{ready:items.every(x=>x.ready),items,classes,timetable});
 }

 // V36.1 — Central reference data: structured settings that feed the platform.
 if(p==='/api/reference-data'&&method==='GET'){
   if(!['teacher','coordinator','owner','inspector'].includes(u.role))return deny(res);
   const inst=u.role==='owner'?(url.searchParams.get('institution_id')||''):u.institution_id;
   if(!inst)return json(res,200,[]);
   if(u.role==='inspector'){
     const allowed=db.prepare('SELECT 1 FROM inspector_institutions WHERE inspector_id=? AND institution_id=?').get(u.id,inst); if(!allowed)return deny(res);
   }
   const rows=db.prepare('SELECT * FROM platform_reference_data WHERE institution_id=? ORDER BY key').all(inst);
   return json(res,200,rows.map(r=>{let value={};try{value=JSON.parse(r.value_json)}catch{}return {...r,value}}));
 }
 if(p==='/api/reference-data'&&method==='POST'){
   if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);
   const b=await body(req),inst=u.role==='owner'?b.institution_id:u.institution_id;
   if(!inst||!sameInst(u,inst))return deny(res);
   if(!b.key||typeof b.value!=='object')return json(res,400,{error:'نوع البيانات ومحتواها مطلوبان'});
   const rid=id();
   db.prepare(`INSERT INTO platform_reference_data(id,institution_id,key,value_json,updated_by,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(institution_id,key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).run(rid,inst,String(b.key),JSON.stringify(b.value),u.id,new Date().toISOString());
   audit(u,'UPSERT','reference_data',rid,{institution_id:inst,key:b.key});
   return json(res,200,{ok:true});
 }
 if(p.startsWith('/api/reference-data/')&&method==='DELETE'){
   if(!['teacher','coordinator','owner'].includes(u.role))return deny(res);
   const key=decodeURIComponent(p.split('/').pop()),inst=u.role==='owner'?(await body(req).catch(()=>({}))).institution_id||u.institution_id:u.institution_id;
   if(!inst||!sameInst(u,inst))return deny(res);
   db.prepare('DELETE FROM platform_reference_data WHERE institution_id=? AND key=?').run(inst,key);audit(u,'DELETE','reference_data',key,{institution_id:inst});return json(res,200,{ok:true});
 }
 if(p==='/api/resources'&&method==='GET'){if(!['teacher','coordinator','owner','inspector'].includes(u.role))return deny(res);const rows=u.role==='owner'?db.prepare(`SELECT r.*,i.name institution_name,u.full_name teacher_name FROM resource_documents r LEFT JOIN institutions i ON i.id=r.institution_id LEFT JOIN users u ON u.id=r.teacher_id ORDER BY r.updated_at DESC`).all():db.prepare(`SELECT r.*,i.name institution_name FROM resource_documents r LEFT JOIN institutions i ON i.id=r.institution_id WHERE r.institution_id=? AND r.active=1 ORDER BY r.updated_at DESC`).all(u.institution_id);return json(res,200,rows.map(r=>({...r,file_url:r.file_path||null})))}
 if(p==='/api/resources'&&method==='POST'&&['teacher','coordinator','owner'].includes(u.role)){const b=await body(req);if(!b.title||!b.category)return json(res,400,{error:'عنوان الوثيقة وتصنيفها مطلوبان'});const inst=u.role==='owner'?b.institution_id:u.institution_id;if(!inst)return json(res,400,{error:'المؤسسة مطلوبة'});let file_path=(String(b.file_path||'').startsWith('/docs/')&&fs.existsSync(path.join(__dirname,String(b.file_path).replace(/^\//,'')))?String(b.file_path):null),file_name=b.file_name||null,mime_type=b.mime_type||null;if(b.data){const raw=String(b.data),m=raw.match(/^data:([^;]+);base64,(.*)$/s);const data=Buffer.from(m?m[2]:raw,'base64');const ext=path.extname(file_name||'')||({'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'.docx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'.xlsx'}[mime_type]||'.bin');const safe=id()+ext;fs.writeFileSync(path.join(__dirname,'assets','resources',safe),data);file_path='/assets/resources/'+safe;}const rid=id();db.prepare('INSERT INTO resource_documents(id,institution_id,teacher_id,title,category,description,school_year,file_name,mime_type,file_path) VALUES(?,?,?,?,?,?,?,?,?,?)').run(rid,inst,u.role==='teacher'?u.id:null,b.title,b.category,b.description||null,b.school_year||'2026-2027',file_name,mime_type,file_path);audit(u,'CREATE','resource',rid,{category:b.category,title:b.title});return json(res,201,{id:rid,file_url:file_path})}
 if(p.startsWith('/api/resources/')&&method==='PUT'&&['teacher','coordinator','owner'].includes(u.role)){const rid=p.split('/').pop(),b=await body(req),x=db.prepare('SELECT * FROM resource_documents WHERE id=?').get(rid);if(!x)return json(res,404,{error:'الوثيقة غير موجودة'});if(u.role!=='owner'&&x.institution_id!==u.institution_id)return deny(res);db.prepare('UPDATE resource_documents SET title=?,category=?,description=?,school_year=?,updated_at=? WHERE id=?').run(b.title||x.title,b.category||x.category,b.description??x.description,b.school_year||x.school_year,new Date().toISOString(),rid);return json(res,200,{ok:true})}
 if(p.startsWith('/api/resources/')&&method==='DELETE'&&['teacher','coordinator','owner'].includes(u.role)){const rid=p.split('/').pop(),x=db.prepare('SELECT * FROM resource_documents WHERE id=?').get(rid);if(!x)return json(res,404,{error:'الوثيقة غير موجودة'});if(u.role!=='owner'&&x.institution_id!==u.institution_id)return deny(res);if(x.file_path&&x.file_path.startsWith('/assets/resources/')){try{fs.unlinkSync(path.join(__dirname,x.file_path.replace(/^\//,'')))}catch{}}db.prepare('DELETE FROM resource_documents WHERE id=?').run(rid);audit(u,'DELETE','resource',rid,{});return json(res,200,{ok:true})}
 if(p==='/api/teacher/export-xlsx'&&method==='POST'&&u.role==='teacher'){
   const b=await body(req),rows=Array.isArray(b.rows)?b.rows:[],sheet=String(b.sheet||'EPS PILOT').replace(/[^\w\u0600-\u06FF -]/g,'').slice(0,31)||'EPS PILOT';
   const py=process.platform==='win32'?(process.env.PYTHON||'python'):('python3');
   const script=`import sys,json,zipfile,io,html\nb=json.load(sys.stdin); rows=b.get('rows',[]); sheet=b.get('sheet','EPS PILOT')\ndef col(n):\n s=''; n+=1\n while n:\n  n,r=divmod(n-1,26); s=chr(65+r)+s\n return s\ndef cell(v,r,c):\n v='' if v is None else str(v); return f'<c r="{col(c)}{r}" t="inlineStr"><is><t>{html.escape(v)}</t></is></c>'\nxml=[]\nfor i,row in enumerate(rows,1):\n vals=row if isinstance(row,list) else list(row.values())\n xml.append(f'<row r="{i}">'+''.join(cell(v,i,j) for j,v in enumerate(vals))+'</row>')\nwb=io.BytesIO()\nwith zipfile.ZipFile(wb,'w',zipfile.ZIP_DEFLATED) as z:\n z.writestr('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')\n z.writestr('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')\n z.writestr('xl/workbook.xml',f'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="{html.escape(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>')\n z.writestr('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')\n z.writestr('xl/worksheets/sheet1.xml',f'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{"".join(xml)}</sheetData></worksheet>')\nopen('/tmp/eps_export.xlsx','wb').write(wb.getvalue())\nimport base64; print(base64.b64encode(wb.getvalue()).decode())`;
   const out=spawnSync(py,['-c',script],{input:JSON.stringify({rows,sheet}),maxBuffer:20*1024*1024});if(out.status!==0)return json(res,500,{error:String(out.stderr||'xlsx generation failed')});const buf=Buffer.from(String(out.stdout).trim(),'base64');res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="eps-pilot-${Date.now()}.xlsx"`});return res.end(buf);
 }
 if(p==='/api/holidays/sync-official'&&method==='POST'&&u.role==='teacher'){
   const sy=String((await body(req)).school_year||'2026-2027'); if(sy!=='2026-2027')return json(res,400,{error:'هذا الإصدار مهيأ حالياً للموسم 2026-2027'});const existing=db.prepare('SELECT COUNT(*) c FROM holidays WHERE institution_id=? AND school_year=?').get(u.institution_id,sy).c;if(existing){db.prepare("DELETE FROM holidays WHERE institution_id=? AND school_year=? AND (kind='official' OR kind='religious')").run(u.institution_id,sy)}
   const fixed=[['2026-10-18','العطلة البينية الأولى / Première période intercalaire','official'],['2026-10-19','العطلة البينية الأولى / Première période intercalaire','official'],['2026-10-20','العطلة البينية الأولى / Première période intercalaire','official'],['2026-10-21','العطلة البينية الأولى / Première période intercalaire','official'],['2026-10-22','العطلة البينية الأولى / Première période intercalaire','official'],['2026-10-23','العطلة البينية الأولى / Première période intercalaire','official'],['2026-10-24','العطلة البينية الأولى / Première période intercalaire','official'],['2026-10-25','العطلة البينية الأولى / Première période intercalaire','official'],['2026-10-31','عيد الوحدة / Fête de l’Unité','official'],['2026-11-06','ذكرى المسيرة الخضراء / Anniversaire de la Marche Verte','official'],['2026-11-18','عيد الاستقلال / Fête de l’Indépendance','official'],['2026-12-06','العطلة البينية الثانية / Deuxième période intercalaire','official'],['2026-12-07','العطلة البينية الثانية / Deuxième période intercalaire','official'],['2026-12-08','العطلة البينية الثانية / Deuxième période intercalaire','official'],['2026-12-09','العطلة البينية الثانية / Deuxième période intercalaire','official'],['2026-12-10','العطلة البينية الثانية / Deuxième période intercalaire','official'],['2026-12-11','العطلة البينية الثانية / Deuxième période intercalaire','official'],['2026-12-12','العطلة البينية الثانية / Deuxième période intercalaire','official'],['2026-12-13','العطلة البينية الثانية / Deuxième période intercalaire','official'],['2027-01-01','فاتح السنة الميلادية / Nouvel An grégorien','official'],['2027-01-11','ذكرى تقديم وثيقة الاستقلال / Anniversaire du Manifeste de l’Indépendance','official'],['2027-01-14','فاتح السنة الأمازيغية / Nouvel An amazigh','official'],['2027-01-24','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-25','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-26','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-27','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-28','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-29','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-30','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-01-31','عطلة منتصف السنة / Vacances de mi-année','official'],['2027-03-21','العطلة البينية الثالثة / Troisième période intercalaire','official'],['2027-03-22','العطلة البينية الثالثة / Troisième période intercalaire','official'],['2027-03-23','العطلة البينية الثالثة / Troisième période intercalaire','official'],['2027-03-24','العطلة البينية الثالثة / Troisième période intercalaire','official'],['2027-03-25','العطلة البينية الثالثة / Troisième période intercalaire','official'],['2027-03-26','العطلة البينية الثالثة / Troisième période intercalaire','official'],['2027-03-27','العطلة البينية الثالثة / Troisième période intercalaire','official'],['2027-03-28','العطلة البينية الثالثة / Troisième période intercalaire','official'],['2027-05-01','عيد الشغل / Fête du Travail','official'],['2027-05-09','العطلة البينية الرابعة / Quatrième période intercalaire','official'],['2027-05-10','العطلة البينية الرابعة / Quatrième période intercalaire','official'],['2027-05-11','العطلة البينية الرابعة / Quatrième période intercalaire','official'],['2027-05-12','العطلة البينية الرابعة / Quatrième période intercalaire','official'],['2027-05-13','العطلة البينية الرابعة / Quatrième période intercalaire','official'],['2027-05-14','العطلة البينية الرابعة / Quatrième période intercalaire','official'],['2027-05-15','العطلة البينية الرابعة / Quatrième période intercalaire','official'],['2027-05-16','العطلة البينية الرابعة / Quatrième période intercalaire','official'],[null,'عيد الفطر: من 29 رمضان إلى 2 شوال 1448 / Aïd al-Fitr (date selon observation)','religious'],[null,'عيد الأضحى: من 9 إلى 11 ذي الحجة 1448 / Aïd al-Adha (date selon observation)','religious'],[null,'فاتح محرم 1449 / 1er Mouharram 1449 (date selon observation)','religious']];const ins=db.prepare('INSERT INTO holidays(id,institution_id,school_year,date,label,kind) VALUES(?,?,?,?,?,?)');for(const x of fixed)ins.run(id(),u.institution_id,sy,x[0],x[1],x[2]);return json(res,200,{ok:true,count:fixed.length,school_year:sy});
 }

 // V39 — Smart EPS engine: student progress, early warning, anomaly detection and role dashboards.
 if(p==='/api/teacher/student-progress'&&method==='GET'&&u.role==='teacher'){
   const cid=url.searchParams.get('class_id');
   const classes=db.prepare(`SELECT c.id,c.name,c.level FROM classes c WHERE c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?)) ORDER BY c.name`).all(u.institution_id,u.id,u.id);
   const ids=cid&&classes.some(x=>x.id===cid)?[cid]:classes.map(x=>x.id); if(!ids.length)return json(res,200,{classes,students:[]});
   const ph=ids.map(()=>'?').join(',');
   const students=db.prepare(`SELECT s.id,s.class_id,s.massar_number,s.first_name,s.last_name,s.gender,s.dob,s.health_note,s.eps_note,c.name class_name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.class_id IN (${ph}) ORDER BY c.name,s.last_name,s.first_name`).all(...ids);
   const out=students.map(st=>{
     const att=db.prepare(`SELECT d.status,COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE d.student_id=? GROUP BY d.status`).all(st.id); const amap=Object.fromEntries(att.map(x=>[x.status,x.c]));
     const results=db.prepare(`SELECT ar.score,ar.pro_score,ar.con_score,a.assessment_date,a.title FROM assessment_results ar JOIN assessments a ON a.id=ar.assessment_id WHERE ar.student_id=? ORDER BY a.assessment_date`).all(st.id);
     const avg=results.length?results.reduce((a,x)=>a+Number(x.score??((Number(x.pro_score)||0)+(Number(x.con_score)||0)),0),0)/results.length:null;
     const sessions=db.prepare(`SELECT COUNT(*) c FROM sessions se JOIN classes c ON c.id=se.class_id WHERE se.id IN (SELECT session_id FROM daily_entries WHERE student_id=?)`).get(st.id).c;
     const total=Object.values(amap).reduce((a,b)=>a+Number(b||0),0); const abs=Number(amap.absent||0),sick=Number(amap.sick||0),late=Number(amap.late||0),uniform=Number(amap.uniform||0);
     const attendanceRate=total?Math.round(((total-abs)/total)*100):null;
     const risk=(abs>=3|| (attendanceRate!==null&&attendanceRate<75) || (avg!==null&&avg<10))?'high':(abs>=2|| (attendanceRate!==null&&attendanceRate<85) || (avg!==null&&avg<12))?'medium':'low';
     return {...st,attendance:{...amap,total,rate:attendanceRate},assessment_average:avg===null?null:Number(avg.toFixed(2)),assessment_count:results.length,sessions,risk};
   });
   return json(res,200,{classes,students:out,generated_at:new Date().toISOString()});
 }
 if(p==='/api/teacher/anomalies'&&method==='GET'&&u.role==='teacher'){
   const rows=db.prepare(`SELECT d.student_id,d.status,d.behavior_score,se.session_date,s.first_name,s.last_name,s.massar_number,c.name class_name FROM daily_entries d JOIN sessions se ON se.id=d.session_id JOIN students s ON s.id=d.student_id JOIN classes c ON c.id=s.class_id WHERE se.teacher_id=? ORDER BY se.session_date DESC LIMIT 1500`).all(u.id);
   const by={}; for(const r of rows){const x=by[r.student_id]??={student_id:r.student_id,name:`${r.last_name||''} ${r.first_name||''}`.trim(),massar:r.massar_number,class_name:r.class_name,absent:0,late:0,uniform:0,sick:0,low_behavior:0,total:0};x.total++;if(r.status==='absent')x.absent++;if(r.status==='late')x.late++;if(r.status==='uniform')x.uniform++;if(r.status==='sick')x.sick++;if(r.behavior_score!=null&&Number(r.behavior_score)<2)x.low_behavior++;}
   const alerts=Object.values(by).map(x=>({...x,level:(x.absent>=3||x.low_behavior>=3)?'high':(x.absent>=2||x.late>=3||x.uniform>=3)?'medium':'low'})).filter(x=>x.level!=='low').sort((a,b)=>({high:0,medium:1}[a.level]-({high:0,medium:1}[b.level]))||b.absent-a.absent); return json(res,200,{alerts});
 }
 if(p==='/api/coordinator/intelligence'&&method==='GET'&&u.role==='coordinator'){
   const inst=u.institution_id; const teachers=db.prepare(`SELECT id,full_name FROM users WHERE institution_id=? AND role='teacher' ORDER BY full_name`).all(inst);
   const classes=db.prepare(`SELECT c.id,c.name,c.level,c.teacher_id,u.full_name teacher_name,(SELECT COUNT(*) FROM students s WHERE s.class_id=c.id) students FROM classes c LEFT JOIN users u ON u.id=c.teacher_id WHERE c.institution_id=? ORDER BY c.name`).all(inst);
   const sessions=db.prepare(`SELECT COUNT(*) c FROM sessions se JOIN classes c ON c.id=se.class_id WHERE c.institution_id=?`).get(inst).c; const reports=db.prepare(`SELECT COUNT(*) c FROM reports WHERE scope_id=? OR scope_id IN (SELECT id FROM classes WHERE institution_id=?)`).get(inst,inst).c;
   const teacherRows=teachers.map(t=>{const ss=db.prepare(`SELECT COUNT(*) c FROM sessions WHERE teacher_id=?`).get(t.id).c;const as=db.prepare(`SELECT COUNT(*) c FROM assessments WHERE teacher_id=?`).get(t.id).c;const absent=db.prepare(`SELECT COUNT(*) c FROM daily_entries d JOIN sessions s ON s.id=d.session_id WHERE s.teacher_id=? AND d.status='absent'`).get(t.id).c;return {...t,sessions:ss,assessments:as,absences:absent};});
   const riskClasses=classes.map(c=>{const n=db.prepare(`SELECT COUNT(*) c FROM students WHERE class_id=?`).get(c.id).c;const abs=db.prepare(`SELECT COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE se.class_id=? AND d.status='absent'`).get(c.id).c;return {...c,absence_rate:n&&sessions?Number((abs/Math.max(1,n*sessions)*100).toFixed(1)):0};}).sort((a,b)=>b.absence_rate-a.absence_rate);
   return json(res,200,{institution_id:inst,teachers:teacherRows,classes,risk_classes:riskClasses,sessions,reports});
 }
 if(p==='/api/inspector/intelligence'&&method==='GET'&&u.role==='inspector'){
   const insts=db.prepare('SELECT i.id,i.name FROM institutions i JOIN inspector_institutions ii ON ii.institution_id=i.id WHERE ii.inspector_id=? ORDER BY i.name').all(u.id); const ids=insts.map(x=>x.id); if(!ids.length)return json(res,200,{institutions:[],summary:{}});
   const ph=ids.map(()=>'?').join(','); const teachers=db.prepare(`SELECT COUNT(*) c FROM users WHERE role='teacher' AND active=1 AND institution_id IN (${ph})`).get(...ids).c; const classes=db.prepare(`SELECT COUNT(*) c FROM classes WHERE institution_id IN (${ph})`).get(...ids).c; const students=db.prepare(`SELECT COUNT(*) c FROM students s JOIN classes c ON c.id=s.class_id WHERE c.institution_id IN (${ph})`).get(...ids).c; const sessions=db.prepare(`SELECT COUNT(*) c FROM sessions se JOIN classes c ON c.id=se.class_id WHERE c.institution_id IN (${ph})`).get(...ids).c;
   const absence=db.prepare(`SELECT COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id JOIN classes c ON c.id=se.class_id WHERE c.institution_id IN (${ph}) AND d.status='absent'`).get(...ids).c;
   const institutionRows=insts.map(i=>{const tc=db.prepare(`SELECT COUNT(*) c FROM users WHERE role='teacher' AND active=1 AND institution_id=?`).get(i.id).c;const cc=db.prepare('SELECT COUNT(*) c FROM classes WHERE institution_id=?').get(i.id).c;const ss=db.prepare(`SELECT COUNT(*) c FROM students s JOIN classes c ON c.id=s.class_id WHERE c.institution_id=?`).get(i.id).c;const se=db.prepare(`SELECT COUNT(*) c FROM sessions se JOIN classes c ON c.id=se.class_id WHERE c.institution_id=?`).get(i.id).c;return {...i,teachers:tc,classes:cc,students:ss,sessions:se};});
   return json(res,200,{institutions:institutionRows,summary:{teachers,classes,students,sessions,absence_entries:absence}});
 }
 if(p==='/api/owner/national-overview'&&method==='GET'&&u.role==='owner'){
   const regions=db.prepare(`SELECT COALESCE(NULLIF(region,''),'غير محدد') region,COUNT(*) institutions FROM institutions GROUP BY COALESCE(NULLIF(region,''),'غير محدد') ORDER BY institutions DESC`).all();
   const totals={institutions:db.prepare('SELECT COUNT(*) c FROM institutions').get().c,teachers:db.prepare("SELECT COUNT(*) c FROM users WHERE role='teacher'").get().c,inspectors:db.prepare("SELECT COUNT(*) c FROM users WHERE role='inspector'").get().c,coordinators:db.prepare("SELECT COUNT(*) c FROM users WHERE role='coordinator'").get().c,classes:db.prepare('SELECT COUNT(*) c FROM classes').get().c,students:db.prepare('SELECT COUNT(*) c FROM students').get().c,sessions:db.prepare('SELECT COUNT(*) c FROM sessions').get().c};
   return json(res,200,{totals,regions});
 }
 if(p==='/api/teacher/smart-report'&&method==='GET'&&u.role==='teacher'){
   const prog=await (async()=>{const fakeReq=url;return null})();
   const classes=db.prepare('SELECT id,name FROM classes WHERE institution_id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=classes.id AND tt.teacher_id=?))').all(u.institution_id,u.id,u.id);
   const lines=[]; for(const c of classes){const st=db.prepare('SELECT COUNT(*) c FROM students WHERE class_id=?').get(c.id).c;const abs=db.prepare(`SELECT COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE se.class_id=? AND se.teacher_id=? AND d.status='absent'`).get(c.id,u.id).c;const ses=db.prepare('SELECT COUNT(*) c FROM sessions WHERE class_id=? AND teacher_id=?').get(c.id,u.id).c;lines.push({class:c.name,students:st,sessions:ses,absence_entries:abs});}
   const content=`تقرير متابعة EPS PILOT\nالأستاذ: ${u.full_name}\nالمؤسسة: ${db.prepare('SELECT name FROM institutions WHERE id=?').get(u.institution_id)?.name||''}\n\n${lines.map(x=>`القسم: ${x.class}\nالتلاميذ: ${x.students}\nالحصص المنجزة: ${x.sessions}\nسجلات الغياب: ${x.absence_entries}`).join('\n\n')}`;
   return json(res,200,{title:'تقرير المتابعة الذكي',content,classes:lines,generated_at:new Date().toISOString()});
 }
 // Full protected health-file management for teachers. JSON fields are intentionally extensible for future medical forms.
 if(p.startsWith('/api/students/')&&p.endsWith('/health-documents')&&method==='GET'&&u.role==='teacher'){
   const sid=p.split('/')[3]; const st=db.prepare(`SELECT s.id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.institution_id,u.id,u.id); if(!st)return deny(res); const docs=db.prepare('SELECT id,student_id,title,file_name,mime_type,document_type,notes,file_path,created_at FROM student_health_documents WHERE student_id=? ORDER BY created_at DESC').all(sid).map(x=>({...x,file_url:x.file_path||null})); return json(res,200,docs);
 }
 if(p.startsWith('/api/students/')&&p.endsWith('/health-documents')&&method==='POST'&&u.role==='teacher'){
   const sid=p.split('/')[3],st=db.prepare(`SELECT s.id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.institution_id,u.id,u.id); if(!st)return deny(res); const b=await body(req); if(!b.title||!b.data)return json(res,400,{error:'عنوان الوثيقة والملف مطلوبان'}); const raw=String(b.data),m=raw.match(/^data:([^;]+);base64,(.*)$/s),mime=b.mime_type||m?.[1]||'application/octet-stream',buf=Buffer.from(m?m[2]:raw,'base64'); if(buf.length>8*1024*1024)return json(res,400,{error:'حجم الوثيقة يتجاوز 8MB'}); const ext=path.extname(b.file_name||'')||'.bin',name=id()+ext,fp=path.join(__dirname,'assets','health',name); fs.writeFileSync(fp,buf); const did=id(); db.prepare('INSERT INTO student_health_documents(id,student_id,title,file_name,mime_type,file_path,document_type,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?)').run(did,sid,b.title,b.file_name||name,mime,'/assets/health/'+name,b.document_type||'medical',b.notes||null,u.id); audit(u,'CREATE','student_health_document',did,{student_id:sid,title:b.title}); return json(res,201,{id:did,file_url:'/assets/health/'+name});
 }
 if(p.startsWith('/api/students/')&&p.includes('/health-documents/')&&method==='DELETE'&&u.role==='teacher'){
   const parts=p.split('/').filter(Boolean),sid=parts[3],did=parts[5]; const st=db.prepare(`SELECT s.id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable tt WHERE tt.class_id=c.id AND tt.teacher_id=?))`).get(sid,u.institution_id,u.id,u.id); if(!st)return deny(res); const d=db.prepare('SELECT * FROM student_health_documents WHERE id=? AND student_id=?').get(did,sid); if(!d)return json(res,404,{error:'الوثيقة غير موجودة'}); try{if(d.file_path)fs.unlinkSync(path.join(__dirname,d.file_path.replace(/^\//,'')))}catch{} db.prepare('DELETE FROM student_health_documents WHERE id=?').run(did);audit(u,'DELETE','student_health_document',did,{student_id:sid});return json(res,200,{ok:true});
 }
// V40 EPS Copilot: explainable local assistant, no external AI dependency.
 if(p==='/api/teacher/copilot'&&method==='POST'&&u.role==='teacher'){
   const b=await body(req); const sport=String(b.sport||'').trim(), objective=String(b.objective||'').trim(), level=String(b.level||'').trim(), duration=Math.max(20,Math.min(180,Number(b.duration||60)));
   if(!sport||!objective)return json(res,400,{error:'النشاط والهدف مطلوبان'});
   const lang0=b.lang||'ar', ar=lang0==='ar', fr=lang0==='fr';
   const warm=ar?'إحماء عام وحركي مرتبط بالنشاط':fr?'Échauffement général et spécifique lié à l’activité':'General and activity-specific warm-up';
   const main=ar?`وضعية تعلمية في ${sport} تستهدف: ${objective}`:fr?`Situation d’apprentissage en ${sport} visant : ${objective}`:`Learning situation in ${sport} targeting: ${objective}`;
   const diff=ar?'تدرج من البسيط إلى المركب مع مراعاة الفروق الفردية':fr?'Progression du simple au complexe avec différenciation':'Progress from simple to complex with differentiation';
   const evalt=ar?'تقويم سريع بمعيار نجاح قابل للملاحظة ثم تصحيح فوري':fr?'Évaluation rapide avec critère observable puis correction immédiate':'Quick assessment with an observable success criterion and immediate feedback';
   const safety=ar?'التحقق من جاهزية التلاميذ والقيود الصحية المسجلة قبل الممارسة':fr?'Vérifier les restrictions de pratique enregistrées avant l’activité':'Check recorded practice restrictions before activity';
   const answer={title:ar?`جذاذة ذكية · ${sport}`:fr?`Fiche intelligente · ${sport}`:`Smart lesson sheet · ${sport}`,objective,level,duration,stages:[{name:ar?'الإحماء':fr?'Échauffement':'Warm-up',minutes:Math.round(duration*.15),text:warm},{name:ar?'الوضعية التعليمية':fr?'Situation d’apprentissage':'Learning situation',minutes:Math.round(duration*.5),text:main},{name:ar?'التدرج والتفريد':fr?'Progression et différenciation':'Progression & differentiation',minutes:Math.round(duration*.2),text:diff},{name:ar?'التقويم':fr?'Évaluation':'Assessment',minutes:Math.round(duration*.1),text:evalt},{name:ar?'السلامة والتهدئة':fr?'Sécurité et retour au calme':'Safety & cool-down',minutes:duration-Math.round(duration*.15)-Math.round(duration*.5)-Math.round(duration*.2)-Math.round(duration*.1),text:safety}],success_criteria:ar?['يحافظ على التقنية الأساسية','ينجز المهمة وفق التعليمات','يتفاعل ويحترم قواعد السلامة']:fr?['Maîtrise le geste essentiel','Réalise la tâche selon les consignes','Respecte les règles de sécurité']:['Masters the key technique','Performs the task as instructed','Follows safety rules']};
   db.prepare('INSERT INTO eps_copilot_history(id,user_id,prompt,answer) VALUES(?,?,?,?)').run(id(),u.id,JSON.stringify({sport,objective,level,duration}),JSON.stringify(answer));
   return json(res,200,{...answer,generated_by:'EPS PILOT Copilot — local explainable engine'});
 }
 if(p==='/api/teacher/smart-plan'&&method==='POST'&&['teacher','coordinator'].includes(u.role)){
   const b=await body(req),sport=String(b.sport||'').trim(),year=String(b.school_year||'2026-2027'),weeks=Math.max(4,Math.min(40,Number(b.weeks||20))); if(!sport)return json(res,400,{error:'النشاط الرياضي مطلوب'}); const ar=(b.lang||'ar')==='ar',fr=(b.lang||'ar')==='fr'; const labels=ar?['التشخيص وبناء المكتسبات','التعلم والتدرج','التثبيت والتطبيق','التقويم والدعم']:fr?['Diagnostic et acquisitions','Apprentissage et progression','Stabilisation et application','Évaluation et remédiation']:['Diagnostic & foundations','Learning & progression','Stabilization & application','Assessment & support']; const units=labels.map((title,i)=>({cycle:i+1,title,sport,session_count:Math.max(1,Math.round(weeks/4)),duration_minutes:Number(b.duration||60),objective:ar?`تنمية ${sport} وفق تدرج مناسب للمستوى مع مراعاة الفروق الفردية.`:fr?`Développer ${sport} selon une progression adaptée au niveau et aux différences individuelles.`:`Develop ${sport} with level-appropriate progression and differentiation.`})); return json(res,200,{school_year:year,weeks,sport,units,generated_by:'EPS PILOT smart planning'});
 }
 if(p==='/api/teacher/sport-safety'&&method==='GET'&&u.role==='teacher'){
   const cid=url.searchParams.get('class_id'); if(!cid)return json(res,400,{error:'القسم مطلوب'});
   const c=db.prepare('SELECT id,name FROM classes WHERE id=? AND institution_id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable WHERE class_id=? AND teacher_id=?))').get(cid,u.institution_id,u.id,cid,u.id); if(!c)return deny(res);
   const rows=db.prepare('SELECT id,first_name,last_name,massar_number,health_note,eps_note,health_profile_json FROM students WHERE class_id=? ORDER BY last_name,first_name').all(cid);
   const alerts=[]; for(const st of rows){let h={};try{h=st.health_profile_json?JSON.parse(st.health_profile_json):{}}catch{}; const txt=JSON.stringify(h)+' '+(st.health_note||'')+' '+(st.eps_note||''); const keys=['restriction','restriction_sport','allerg','asthm','injur','medic','contraind','interdit','limitation','doctor','clearance']; if(keys.some(k=>txt.toLowerCase().includes(k)))alerts.push({student_id:st.id,name:`${st.last_name||''} ${st.first_name||''}`.trim(),massar:st.massar_number,notice:String(req.headers['x-language']||'ar')==='fr'?'Consulter le dossier santé avant la pratique.':String(req.headers['x-language']||'ar')==='en'?'Review the health file before activity.':'يرجى مراجعة الملف الصحي قبل الممارسة.'});}
   return json(res,200,{class:c,alerts,count:alerts.length,notice:String(req.headers['x-language']||'ar')==='fr'?'Alerte indicative, sans diagnostic.':String(req.headers['x-language']||'ar')==='en'?'Indicative alert, not a diagnosis.':'تنبيه إرشادي فقط وليس تشخيصاً طبياً.'});
 }
 if(p==='/api/teacher/class-comparison'&&method==='GET'&&u.role==='teacher'){
   const classes=db.prepare('SELECT c.id,c.name,c.level FROM classes c WHERE c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable t WHERE t.class_id=c.id AND t.teacher_id=?)) ORDER BY c.name').all(u.institution_id,u.id,u.id);
   const out=classes.map(c=>{const students=db.prepare('SELECT COUNT(*) c FROM students WHERE class_id=?').get(c.id).c;const sessions=db.prepare('SELECT COUNT(*) c FROM sessions WHERE class_id=? AND teacher_id=?').get(c.id,u.id).c;const abs=db.prepare(`SELECT COUNT(*) c FROM daily_entries d JOIN sessions se ON se.id=d.session_id WHERE se.class_id=? AND se.teacher_id=? AND d.status='absent'`).get(c.id,u.id).c;const avg=db.prepare(`SELECT AVG(ar.score) a FROM assessment_results ar JOIN assessments a ON a.id=ar.assessment_id WHERE a.class_id=? AND a.teacher_id=?`).get(c.id,u.id).a;return {...c,students,sessions,absence_entries:abs,assessment_average:avg==null?null:Number(avg.toFixed(2))};}); return json(res,200,{classes:out});
 }
 if(p==='/api/teacher/report-builder'&&method==='GET'&&u.role==='teacher'){
   const cid=url.searchParams.get('class_id'); const c=cid?db.prepare('SELECT * FROM classes WHERE id=? AND institution_id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable WHERE class_id=? AND teacher_id=?))').get(cid,u.institution_id,u.id,cid,u.id):null; if(cid&&!c)return deny(res);
   const classes=cid?[c]:db.prepare('SELECT id,name,level FROM classes WHERE institution_id=? AND (teacher_id=? OR EXISTS(SELECT 1 FROM timetable WHERE class_id=classes.id AND teacher_id=?))').all(u.institution_id,u.id,u.id);
   const rows=classes.map(x=>{const n=db.prepare('SELECT COUNT(*) c FROM students WHERE class_id=?').get(x.id).c;const se=db.prepare('SELECT COUNT(*) c FROM sessions WHERE class_id=? AND teacher_id=?').get(x.id,u.id).c;const ab=db.prepare(`SELECT COUNT(*) c FROM daily_entries d JOIN sessions s ON s.id=d.session_id WHERE s.class_id=? AND s.teacher_id=? AND d.status='absent'`).get(x.id,u.id).c;const av=db.prepare(`SELECT AVG(ar.score) a FROM assessment_results ar JOIN assessments a ON a.id=ar.assessment_id WHERE a.class_id=? AND a.teacher_id=?`).get(x.id,u.id).a;return {class_id:x.id,class_name:x.name,level:x.level,students:n,sessions:se,absence_entries:ab,assessment_average:av==null?null:Number(av.toFixed(2))};});
   return json(res,200,{title:cid?`تقرير القسم · ${c.name}`:'تقرير المتابعة للأقسام',rows,generated_at:new Date().toISOString()});
 }
 if(p==='/api/teacher/transfer-request'&&method==='POST'&&u.role==='teacher'){
   const b=await body(req),to=b.to_institution_id; const target=db.prepare('SELECT id,name FROM institutions WHERE id=? AND id<>?').get(to,u.institution_id); if(!target)return json(res,400,{error:'المؤسسة المستهدفة غير صالحة'});
   const q=id(); db.prepare('INSERT INTO transfer_requests(id,teacher_id,from_institution_id,to_institution_id,requested_by,status) VALUES(?,?,?,?,?,?)').run(q,u.id,u.institution_id,to,u.id,'pending'); const owners=db.prepare("SELECT id FROM users WHERE role='owner' AND active=1").all(); for(const o of owners)db.prepare('INSERT INTO notifications(id,user_id,title,body,type,read_at,created_at,related_id) VALUES(?,?,?,?,?,?,?,?)').run(id(),o.id,'طلب انتقال أستاذ',`${u.full_name} — ${target.name}`,'transfer',null,new Date().toISOString(),q); audit(u,'CREATE','transfer_request',q,{to_institution_id:to}); return json(res,201,{id:q,status:'pending'});
 }
 if(p==='/api/owner/transfer-requests'&&method==='GET'&&u.role==='owner'){return json(res,200,db.prepare(`SELECT tr.*,tu.full_name teacher_name,fi.name from_name,ti.name to_name FROM transfer_requests tr JOIN users tu ON tu.id=tr.teacher_id LEFT JOIN institutions fi ON fi.id=tr.from_institution_id LEFT JOIN institutions ti ON ti.id=tr.to_institution_id ORDER BY tr.created_at DESC`).all());}
 if(p.startsWith('/api/owner/transfer-requests/')&&method==='PATCH'&&u.role==='owner'){
   const rid=p.split('/').pop(),b=await body(req),r=db.prepare('SELECT * FROM transfer_requests WHERE id=?').get(rid); if(!r)return json(res,404,{error:'طلب الانتقال غير موجود'}); const status=b.status||'approved';
   if(status==='approved'){const tx=db.prepare('SELECT id FROM institutions WHERE id=?').get(r.to_institution_id);if(!tx)return json(res,400,{error:'المؤسسة غير موجودة'}); db.exec('BEGIN'); try{db.prepare('UPDATE users SET institution_id=? WHERE id=?').run(r.to_institution_id,r.teacher_id); db.prepare('UPDATE classes SET institution_id=? WHERE teacher_id=?').run(r.to_institution_id,r.teacher_id); db.prepare('UPDATE timetable SET institution_id=? WHERE teacher_id=?').run(r.to_institution_id,r.teacher_id); db.prepare('INSERT INTO transfer_history(id,teacher_id,from_institution_id,to_institution_id,approved_by) VALUES(?,?,?,?,?)').run(id(),r.teacher_id,r.from_institution_id,r.to_institution_id,u.id); db.prepare('UPDATE transfer_requests SET status=?,verified=1 WHERE id=?').run('approved',rid); db.exec('COMMIT')}catch(e){try{db.exec('ROLLBACK')}catch{};throw e}} else db.prepare('UPDATE transfer_requests SET status=? WHERE id=?').run(status,rid); audit(u,'UPDATE','transfer_request',rid,{status}); return json(res,200,{ok:true,status});
 }
 if(p==='/api/owner/report-document'&&method==='POST'&&u.role==='owner'){
   const b=await body(req),num='EPS-DOC-'+new Date().getFullYear()+'-'+String(Date.now()).slice(-8); const rid=id(); db.prepare('INSERT INTO report_documents(id,author_id,institution_id,document_number,title,category,content) VALUES(?,?,?,?,?,?,?)').run(rid,u.id,b.institution_id||null,num,b.title||'وثيقة رسمية',b.category||'report',b.content||''); audit(u,'CREATE','report_document',rid,{document_number:num}); return json(res,201,{id:rid,document_number:num});
 }
 if(p==='/api/owner/backup'&&method==='GET'&&u.role==='owner'){
   try{db.exec('PRAGMA wal_checkpoint(TRUNCATE)')}catch{} const dir=path.join(DB_DIR,'backups');fs.mkdirSync(dir,{recursive:true});const name=`eps-pilot-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`;const dest=path.join(dir,name);fs.copyFileSync(path.join(DB_DIR,'eps_pilot.sqlite'),dest);audit(u,'BACKUP','database',name,{});res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${name}"`,'Content-Length':String(fs.statSync(dest).size)});fs.createReadStream(dest).pipe(res);return;
 }
 if(p==='/api/owner/audit-summary'&&method==='GET'&&u.role==='owner'){
   const rows=db.prepare(`SELECT action,entity,COUNT(*) count FROM audit_log GROUP BY action,entity ORDER BY count DESC LIMIT 30`).all(); return json(res,200,{rows});
 }

 return json(res,404,{error:'Route غير موجودة'});
}

function scheduleKey(period){const d=new Date();const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');if(period==='daily')return `${y}-${m}-${day}`;const one=new Date(y,0,1),week=Math.ceil((((d-one)/86400000)+one.getDay()+1)/7);return period==='weekly'?`${y}-W${week}`:`${y}-${m}`;}
function scheduledExists(period){const key=scheduleKey(period);return !!db.prepare('SELECT 1 FROM owner_ai_reports WHERE period=? AND title LIKE ?').get(period,`%${key}%`)}
function runScheduledReports(){try{const active=db.prepare('SELECT period FROM owner_report_schedules WHERE active=1').all();const ov=ownerOverviewData();for(const {period} of active){const key=scheduleKey(period);if(scheduledExists(period))continue;const rid=id();const title=`تقرير ${period==='daily'?'يومي':period==='weekly'?'أسبوعي':'شهري'} · ${key}`;db.prepare('INSERT INTO owner_ai_reports(id,period,title,content) VALUES(?,?,?,?)').run(rid,period,title,aiOwnerSummary(period,ov));}}catch(e){console.error('scheduler',e.message)}}

function seedDemoTeacherTimetable(){
 try{
  const teacher=db.prepare("SELECT id,institution_id FROM users WHERE username='teacher' AND role='teacher'").get(); if(!teacher)return;
  const classes=db.prepare('SELECT id,name FROM classes WHERE teacher_id=? ORDER BY name').all(teacher.id); if(classes.length<2)return;
  const pick=(patterns,idx)=>{const hit=classes.find(c=>patterns.some(p=>String(c.name).toUpperCase().includes(p)));return hit?.id||classes[idx%classes.length].id};
  const c1=pick(['1BACSE','1BAC'],0), c2=pick(['TCS','TC-'],1), c3=pick(['TCLSH','TC-B'],2); 
  const slots=[
   [1,'09:00','10:00',c1,'EPS · 1BACSE FR-1'],[1,'10:00','11:00',c2,'EPS · TCS (FR)-3'],[1,'11:00','12:00',c3,'EPS · TCLSH (FR)-2'],[1,'12:00','13:00',c3,'EPS · TCLSH (FR)-2'],
   [2,'09:00','10:00',c2,'EPS · TCS (FR)-2'],[2,'10:00','11:00',c3,'EPS · TCLSH (FR)-1'],[2,'11:00','12:00',c2,'EPS · TCS (FR)-3'],[2,'12:00','13:00',c1,'EPS · 1BACSE FR-2'],
   [3,'09:00','10:00',c2,'EPS · TCS (FR)-2'],[3,'10:00','11:00',c1,'EPS · 1BACSE FR-1'],[3,'11:00','12:00',c3,'EPS · TCLSH (FR)-1'],[3,'12:00','13:00',c2,'EPS · TCS (FR)-1'],
   [4,'09:00','10:00',c3,'EPS · TCLSH (FR)-3'],[4,'10:00','11:00',c1,'EPS · 1BACSE FR-1'],[4,'11:00','12:00',c3,'EPS · TCLSH (FR)-2'],[4,'12:00','13:00',c1,'EPS · 1BACSE FR-2'],
   [5,'09:00','10:00',c1,'EPS · 1BACSE FR-2'],[5,'10:00','11:00',c3,'EPS · TCLSH (FR)-3'],[5,'11:00','12:00',c2,'EPS · TCS (FR)-2'],[5,'12:00','13:00',c3,'EPS · TCLSH (FR)-2']
  ];
  for(const [dow,st,en,cid,act] of slots){const exists=db.prepare('SELECT id FROM timetable WHERE teacher_id=? AND class_id=? AND day_of_week=? AND start_time=?').get(teacher.id,cid,String(dow),st);if(!exists)db.prepare('INSERT INTO timetable VALUES(?,?,?,?,?,?,?,?,?)').run(id(),teacher.institution_id,teacher.id,cid,String(dow),st,en,act,null);}
 }catch(e){console.error('demo timetable',e.message)}
}
function serve(req,res){
 let f=req.url==='/'?'/index.html':req.url;
 f=decodeURIComponent(f.split('?')[0]);
 // Never expose the SQLite database, its WAL/journal files, backups, or protected health documents as public static files.
 if(/^\/(?:database|data)(?:\/|$)/i.test(f)||/^\/assets\/health(?:\/|$)/i.test(f)){
   const su=auth(req);
   if(/^\/(?:database|data)/i.test(f)) return json(res,404,{error:'Not found'});
   if(!su) return deny(res);
   const clean=path.posix.normalize(f);
   const doc=db.prepare('SELECT * FROM student_health_documents WHERE file_path=? LIMIT 1').get(clean);
   if(!doc) return json(res,404,{error:'Not found'});
   if(su.role==='owner'){
     // owner is allowed to access protected health documents only through an authenticated request
   }else if(su.role==='teacher'){
     const ok=db.prepare(`SELECT s.id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=? AND c.institution_id=? AND (c.teacher_id=? OR EXISTS(SELECT 1 FROM timetable t WHERE t.class_id=c.id AND t.teacher_id=?))`).get(doc.student_id,su.institution_id,su.id,su.id);
     if(!ok) return deny(res);
   }else return deny(res);
 }
 const file=path.normalize(path.join(__dirname,f));
 if(!file.startsWith(__dirname)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return json(res,404,{error:'Not found'});
 const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.pdf':'application/pdf','.json':'application/json','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
 res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600'});fs.createReadStream(file).pipe(res)
}
http.createServer((req,res)=>{if(req.url.startsWith('/api/'))route(req,res).catch(e=>{console.error(e);json(res,500,{error:'خطأ داخلي',detail:e.message})});else serve(req,res)}).listen(PORT,()=>{enforceSubscriptionExpiry();runScheduledReports();setInterval(enforceSubscriptionExpiry,3600000);setInterval(runScheduledReports,60000);console.log(`EPS PILOT running at http://localhost:${PORT}`)});
