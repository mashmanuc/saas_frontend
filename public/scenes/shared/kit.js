// kit.js — спільні хелпери + маскот Інтегралик. Потрібен assistant-icon.js перед цим файлом.
window.$=id=>document.getElementById(id);
// M4SH (2026-10-20): мова — з <html lang> сторінки (uk | en); вигляд маскота — ?look=integralka|integralyk від дошки.
const EN=document.documentElement.lang==='en';
const LOOK=new URLSearchParams(location.search).get('look');
const REDUCE=matchMedia('(prefers-reduced-motion:reduce)').matches;
window.Kit={
C:{paper:'#fffaf0',paper2:'#f4ede0',ink:'#1a1612',ink2:'#3a2f24',ink3:'#6a594a',line:'#d6c8b2',acc:'#c4622a',blue:'#3b7b9b',green:'#4d8b5a',take:'#e9a06f',take2:'#a9cbdc',green2:'#b9d6aa',empty:'#fdf6e8',both:'#9a7aa8'},
gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b]}return a},
lcm(a,b){return a/Kit.gcd(a,b)*b},
clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
num:v=>{const s=(+(+v).toFixed(2)).toString();return (EN?s:s.replace('.',',')).replace('-','−')},
frac:(n,d,cls='')=>`<span class="fq ${cls}"><i>${n}</i><i>${d}</i></span>`,
txt(x,y,s,o={}){return `<text x="${x}" y="${y}" text-anchor="${o.a||'middle'}" font-family="${o.serif?'Times New Roman,serif':'JetBrains Mono,monospace'}" font-size="${o.size||13}" font-weight="${o.w||(o.serif?700:500)}" fill="${o.fill||'#1a1612'}"${o.extra||''}>${s}</text>`},
svgPt(svg,e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse())},
tween(ms,f,done){if(REDUCE){f(1);done&&done();return}const t0=performance.now();const step=now=>{const t=Math.min(1,(now-t0)/ms),e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;f(e);t<1?requestAnimationFrame(step):done&&done()};requestAnimationFrame(step)},
// <div class="stp" data-k="a"></div> → − значення +
steppers(st,lim,cb){document.querySelectorAll('.stp').forEach(el=>{const k=el.dataset.k;el.innerHTML='<button data-d="-1" aria-label="'+(EN?'less':'менше')+'">−</button><span></span><button data-d="1" aria-label="'+(EN?'more':'більше')+'">+</button>';
el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const [mn,mx]=lim[k];const v=Kit.clamp(st[k]+ +b.dataset.d,mn,mx);if(v===st[k])return;st[k]=v;cb(k);Kit.sync(st)})});Kit.sync(st)},
sync(st){document.querySelectorAll('.stp').forEach(el=>{const s=el.querySelector('span');if(s)s.textContent=String(st[el.dataset.k]).replace('-','−')})}
};
window.Mascot=(function(){
const STAR='<svg viewBox="0 0 24 24"><path d="M12 1l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill="#f5b83d" stroke="#b7791f" stroke-width="1.2"></path></svg>';
let el,stage;
function make(){el=document.createElement('div');el.className='fm';el.title=EN?'Integralyk':'Інтегралик';
const g=LOOK?LOOK==='integralka':localStorage.getItem('integ_gender')==='girl',src=(g?window.ASSISTANT_ICON_GIRL:window.ASSISTANT_ICON)||'';
el.innerHTML=src.replace(/ id="[^"]*"/g,'').replace('<svg','<svg class="body"')+'<svg class="wand" viewBox="0 0 44 44"><line x1="40" y1="40" x2="10" y2="10" stroke="#3a2a1a" stroke-width="4.5" stroke-linecap="round"></line><line x1="14" y1="14" x2="10" y2="10" stroke="#fff" stroke-width="4.5" stroke-linecap="round"></line><path d="M6 0l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#f5b83d"></path></svg>';
el.onclick=()=>cast()}
function burst(x,y){if(REDUCE)return;for(let i=0;i<10;i++){const s=document.createElement('div'),a=i/10*Math.PI*2,r=40+Math.random()*30;s.className='fm-spark';stage.appendChild(s);
s.animate([{transform:`translate(${x-4}px,${y-4}px) scale(1)`,opacity:1},{transform:`translate(${x-4+Math.cos(a)*r}px,${y-4+Math.sin(a)*r}px) scale(.3)`,opacity:0}],{duration:600,easing:'ease-out'}).onfinish=()=>s.remove()}}
function cast(fx=.46,fy=.42){if(!el||!stage)return;el.classList.remove('cast');void el.offsetWidth;el.classList.add('cast');
const v=$('view'),svg=v&&v.firstElementChild;if(svg&&svg.classList){svg.classList.remove('fresh');void svg.getBoundingClientRect();svg.classList.add('fresh')}
if(REDUCE)return;const sr=stage.getBoundingClientRect(),w=el.querySelector('.wand').getBoundingClientRect(),x0=w.left-sr.left-8,y0=w.top-sr.top-8,x1=sr.width*fx,y1=sr.height*fy;
const st=document.createElement('div');st.className='fm-star';st.innerHTML=STAR;stage.appendChild(st);
st.animate([{transform:`translate(${x0}px,${y0}px) scale(.5)`},{transform:`translate(${(x0+x1)/2}px,${Math.min(y0,y1)-70}px) scale(1.3) rotate(200deg)`},{transform:`translate(${x1}px,${y1}px) scale(1) rotate(360deg)`,opacity:1,offset:.85},{transform:`translate(${x1}px,${y1}px) scale(2.4) rotate(400deg)`,opacity:0}],{duration:750,easing:'ease-in-out'}).onfinish=()=>{st.remove();burst(x1+12,y1+12)}}
function cheer(){if(!el)return;el.classList.remove('cheer');void el.offsetWidth;el.classList.add('cheer');const sr=stage.getBoundingClientRect(),r=el.getBoundingClientRect();burst(r.left-sr.left+r.width/2,r.top-sr.top+10)}
return{attach(s){stage=s;if(!el)make();s.appendChild(el)},cast,cheer};
})();
addEventListener('DOMContentLoaded',()=>{const s=$('stage');if(s)Mascot.attach(s)});
