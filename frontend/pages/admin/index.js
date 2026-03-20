import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";

const ADMIN_PASSWORD = "585858";
const STORAGE_KEY = "la1_admin_auth";

export default function Admin(){

const [users,setUsers] = useState([]);
const [deposits,setDeposits] = useState([]);
const [leads,setLeads] = useState([]);
const [auth,setAuth] = useState(false);
const [input,setInput] = useState("");
const [error,setError] = useState("");

useEffect(()=>{
  if(localStorage.getItem(STORAGE_KEY) === ADMIN_PASSWORD){
    setAuth(true);
    loadData();
  }
},[]);

function loadData(){
  fetch(process.env.NEXT_PUBLIC_API+"/admin/users")
  .then(r=>r.json())
  .then(setUsers);

  fetch(process.env.NEXT_PUBLIC_API+"/admin/deposits")
  .then(r=>r.json())
  .then(setDeposits);

  fetch(process.env.NEXT_PUBLIC_API+"/admin/leads")
  .then(r=>r.json())
  .then(setLeads);
}

function login(){
  if(input === ADMIN_PASSWORD){
    localStorage.setItem(STORAGE_KEY, ADMIN_PASSWORD);
    setAuth(true);
    setError("");
    loadData();
  } else {
    setError("密碼錯誤，請重試");
  }
}

function logout(){
  localStorage.removeItem(STORAGE_KEY);
  setAuth(false);
  setInput("");
}

if(!auth) return(
<div style={{background:"#0a0a0a",minHeight:"100vh"}}>
<Navbar/>
<div style={{maxWidth:360,margin:"140px auto",textAlign:"center",padding:"0 20px"}}>
  <h2 style={{fontSize:28,marginBottom:8,background:"linear-gradient(90deg,#7c3aed,#3b82f6)",WebkitBackgroundClip:"text",color:"transparent"}}>
    🔐 後台登入
  </h2>
  <p style={{color:"#666",marginBottom:24,fontSize:14}}>LA1 管理系統</p>
  <input
    type="password"
    value={input}
    onChange={e=>setInput(e.target.value)}
    onKeyDown={e=>e.key==="Enter"&&login()}
    placeholder="請輸入管理密碼"
    style={{display:"block",width:"100%",padding:"14px 16px",background:"#1a1a1a",border:"1px solid #333",borderRadius:10,color:"#fff",fontSize:16,boxSizing:"border-box",marginBottom:12,outline:"none"}}
  />
  {error && <p style={{color:"#ff4444",fontSize:14,marginBottom:12}}>{error}</p>}
  <button
    onClick={login}
    style={{width:"100%",padding:"14px",background:"linear-gradient(90deg,#7c3aed,#3b82f6)",border:"none",borderRadius:10,color:"#fff",fontSize:16,fontWeight:600,cursor:"pointer"}}
  >
    進入後台
  </button>
</div>
</div>
);

return(
<div style={{background:"#0a0a0a",minHeight:"100vh"}}>
<Navbar/>
<div style={{padding:40,maxWidth:900,margin:"80px auto"}}>

<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:30}}>
  <h1 style={{fontSize:32,margin:0,background:"linear-gradient(90deg,#7c3aed,#3b82f6)",WebkitBackgroundClip:"text",color:"transparent"}}>LA1 後台管理</h1>
  <button onClick={logout} style={{padding:"8px 20px",background:"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#888",cursor:"pointer",fontSize:14}}>登出</button>
</div>

<h2>👤 會員（{users.length}）</h2>
<div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:20,marginBottom:30}}>
{users.length===0 ? <p style={{color:"#888"}}>暫無會員</p> :
users.map(u=>(
  <div key={u.id} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between"}}>
    <span>ID:{u.id} | {u.username}</span>
    <span style={{color:"#00ffcc"}}>💰 ${u.balance}</span>
  </div>
))}
</div>

<h2>💰 儲值記錄（{deposits.length}）</h2>
<div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:20,marginBottom:30}}>
{deposits.length===0 ? <p style={{color:"#888"}}>暫無記錄</p> :
deposits.map(d=>(
  <div key={d.id} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between"}}>
    <span>用戶:{d.user_id} | ${d.amount}</span>
    <span style={{color:d.status==="done"?"#00ffcc":"#ffaa00"}}>{d.status}</span>
  </div>
))}
</div>

<h2>📩 CRM Leads（{leads.length}）</h2>
<div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:20}}>
{leads.length===0 ? <p style={{color:"#888"}}>暫無 Leads</p> :
leads.map(l=>(
  <div key={l.id} style={{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between"}}>
    <span>TG: {l.tg_username || l.tg_id}</span>
    <span style={{color:l.status==="paid"?"#00ffcc":l.status==="interested"?"#ffaa00":"#888"}}>{l.status}</span>
  </div>
))}
</div>

</div>
</div>
);
}
