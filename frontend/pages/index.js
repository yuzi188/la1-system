import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Card from "../components/Card";
import PlayerFeed from "../components/PlayerFeed";

export default function Home(){
return(
<div>
<Navbar/>
<Hero/>
<PlayerFeed/>
<div className="grid">
{[
  {name:"🎰 老虎機",img:"/images/slot.jpg"},
  {name:"🎯 輪盤",img:"/images/roulette.jpg"},
  {name:"🃏 百家樂",img:"/images/baccarat.jpg"},
  {name:"🤖 AI推薦",img:"/images/ai.jpg"}
].map(g=>(
  <Card key={g.name} img={g.img} name={g.name}/>
))}
</div>
<PlayerFeed/>
<div className="cta">
<h2>📩 聯繫客服</h2>
<button className="btn" onClick={()=>window.open("https://t.me/LA1111_bot")}>
Telegram
</button>
</div>
</div>
)
}
