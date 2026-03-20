import {useState} from "react";
import Navbar from "../components/Navbar";

export default function Login(){
const [u,setU]=useState('');
const [p,setP]=useState('');
const [mode,setMode]=useState('login');

const submit=async()=>{
  const endpoint = mode === 'login' ? '/login' : '/register';
  const res = await fetch(process.env.NEXT_PUBLIC_API+endpoint,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username:u,password:p})
  });
  const data = await res.json();
  if(data.token){
    localStorage.setItem("token",data.token);
    location.href="/dashboard";
  } else if(data.ok){
    alert("註冊成功，請登入");
    setMode('login');
  } else {
    alert("失敗，請重試");
  }
}

return(
<div>
<Navbar/>
<div style={{maxWidth:400,margin:"100px auto",textAlign:"center"}}>
<h2>{mode==='login'?'登入':'註冊'}</h2>
<input onChange={e=>setU(e.target.value)} placeholder="帳號" style={{display:"block",width:"100%",padding:12,margin:"10px 0",background:"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#fff"}}/>
<input type="password" onChange={e=>setP(e.target.value)} placeholder="密碼" style={{display:"block",width:"100%",padding:12,margin:"10px 0",background:"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#fff"}}/>
<button className="btn" onClick={submit} style={{width:"100%",marginTop:10}}>{mode==='login'?'登入':'註冊'}</button>
<p style={{marginTop:20,color:"#888",cursor:"pointer"}} onClick={()=>setMode(mode==='login'?'register':'login')}>
{mode==='login'?'沒有帳號？點此註冊':'已有帳號？點此登入'}
</p>
</div>
</div>
)
}
