import {useEffect,useState} from "react";
import Navbar from "../components/Navbar";

export default function Dashboard(){
const [user,setUser]=useState({});

useEffect(()=>{
  const token = localStorage.getItem("token");
  if(!token) { location.href="/login"; return; }
  fetch(process.env.NEXT_PUBLIC_API+"/me",{
    headers:{Authorization:token}
  })
  .then(r=>r.json())
  .then(setUser);
},[]);

return(
<div>
<Navbar/>
<div style={{maxWidth:600,margin:"80px auto",textAlign:"center"}}>
<h2>歡迎，{user.username}</h2>
<div style={{fontSize:40,margin:20,background:"linear-gradient(90deg,#7c3aed,#3b82f6)",WebkitBackgroundClip:"text",color:"transparent"}}>
💰 餘額：${user.balance || 0}
</div>
<button className="btn" onClick={()=>location.href="/deposit"}>儲值</button>
</div>
</div>
)
}
