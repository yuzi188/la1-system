export default function Card({img, name}){
  return(
    <div className="card">
      <img src={img} style={{width:"100%"}}/>
      <div className="overlay-btn">{name || "立即進入"}</div>
    </div>
  )
}
