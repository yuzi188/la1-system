export default function Home(){

const pay = async ()=>{
  const token = localStorage.getItem("t");

  const res = await fetch(process.env.NEXT_PUBLIC_API+"/create-payment",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      Authorization:token
    },
    body:JSON.stringify({amount:100})
  });

  const data = await res.json();
  window.open(data.invoice_url);
};

return(
<div style={{background:"#0a0a0a",color:"#fff"}}>

<div style={{height:"80vh",position:"relative"}}>
<img src="/hero.jpg" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)"}}/>

<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
<h1 style={{fontSize:60}}>LA1</h1>
<button onClick={()=>window.open("https://t.me/LA1111_bot")}
style={{padding:"12px 24px",background:"linear-gradient(to right,#9333ea,#3b82f6)",border:"none",color:"#fff",borderRadius:12,cursor:"pointer",fontSize:18}}>
🔥 立即開始
</button>
</div>
</div>

<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20,padding:40}}>
{["slot","roulette","baccarat","ai"].map(g=>(
<div key={g} style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:16,textAlign:"center"}}>
<h3>{g.toUpperCase()}</h3>
</div>
))}
</div>

<div style={{textAlign:"center",padding:40}}>
<button onClick={pay}
style={{padding:"12px 24px",background:"#22c55e",border:"none",color:"#fff",borderRadius:12,cursor:"pointer",fontSize:18}}>
💰 儲值
</button>
</div>

</div>
)
}
