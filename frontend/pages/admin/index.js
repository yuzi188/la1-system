import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";

export default function Admin(){

const [users,setUsers] = useState([]);
const [deposits,setDeposits] = useState([]);
const [leads,setLeads] = useState([]);
const [auth,setAuth] = useState(false);

useEffect(()=>{
  if(localStorage.getItem("admin") !== "1"){
    setAuth(false);
    return;
  }
  setAuth(true);

  fetch(process.env.NEXT_PUBLIC_API+"/admin/users")
  .then(r=>r.json())
  .then(setUsers);

  fetch(process.env.NEXT_PUBLIC_API+"/admin/deposits")
  .then(r=>r.json())
  .then(setDeposits);

  fetch(process.env.NEXT_PUBLIC_API+"/admin/leads")
  .then(r=>r.json())
  .then(setLeads);
},[]);

if(!auth) return(
<div>
<Navbar/>
<div style={{textAlign:"center",marginTop:200,fontSize:24,color:"#ff4444"}}>
🔒 禁止訪問
</div>
</div>
);

return(
<div>
<Navbar/>
<div style={{padding:40,maxWidth:900,margin:"80px auto"}}>

<h1 style={{fontSize:32,marginBottom:30,background:"linear-gradient(90deg,#7c3aed,#3b82f6)",WebkitBackgroundClip:"text",color:"transparent"}}>LA1 後台管理</h1>

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
