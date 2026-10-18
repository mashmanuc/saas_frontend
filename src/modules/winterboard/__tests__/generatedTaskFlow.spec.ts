/** Стендова регресія: п'ять задач, одночасний auto-fit, без втрати ручних позицій. */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { useWBStore } from '../board/state/boardStore'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import { flowOf, managedFlow, reflowGenerated, generatedFitPageH } from '../board/state/generatedTaskFlow'
import { applyReplayOperation } from '../engine/applyReplayOperation'
import type { WBAsset, WBPage } from '../types/winterboard'

const data = (a:WBAsset):Record<string,unknown> => a.data as unknown as Record<string,unknown>
function page(n=5): WBPage {
  const members=Array.from({length:n},(_,i)=>`t${i}`)
  return {id:'p',name:'Задачі',strokes:[],height:60+Math.ceil(n/2)*2020+40,assets:members.map((id,i)=>{
    const x=60+(i%2)*880,y=60+Math.floor(i/2)*400
    return {id,type:'nmt_task',src:'',x,y,w:860,h:380,rotation:0,locked:false,
      data:{version:1,question:'$x^2-1$',showSolution:false,generatedFlow:{version:1,groupId:'p',members,
        row:Math.floor(i/2),x,y,w:860,h:380,rotation:0,top:60,gap:20,rowLimit:2000}}} as unknown as WBAsset
  })}
}
const fit=(a:WBAsset,h:number):WBAsset=>({...a,h,data:{...data(a),autoFitH:h} as unknown as WBAsset['data']})
function noOverlap(p:WBPage) {
  for (let i=0;i<p.assets.length;i++) for (const b of p.assets.slice(i+1)) {
    const a=p.assets[i]
    expect(a.x<b.x+b.w && b.x<a.x+a.w && a.y<b.y+b.h && b.y<a.y+a.h,`${a.id}/${b.id}`).toBe(false)
  }
}
beforeEach(()=>{flushPendingUpdates();setActivePinia(createPinia())})
describe('керована нова добірка',()=>{
  it('усі hosts показують висоту добірки; фон скидає кеш при гідратації розмірів',()=>{
    for(const host of ['WBSoloRoom','WBConstructorRoom','WBClassroomRoom','WBPublicView','WBContentPreview']) {
      expect(readFileSync(`src/modules/winterboard/views/${host}.vue`,'utf8'))
        .toContain(':height="store.currentPageCanvasHeight"')
    }
    const source=readFileSync('src/modules/winterboard/components/canvas/WBCanvas.vue','utf8')
    expect(source).toMatch(/\[wbStore\.currentPageBgColor, props\.width, props\.height\][\s\S]{0,180}layer\?\.clearCache/)
    expect(readFileSync('src/modules/winterboard/views/WBSoloRoom.vue','utf8'))
      .toContain('fit(store.currentPageCanvasHeight !== store.pageHeight ? store.pageHeight : undefined)')
  })
  it('полотно показує збережену висоту добірки; старі сторінки не змінені',()=>{
    const store=useWBStore();store.pages=[page()]
    expect(store.currentPageCanvasHeight).toBe(6160)
    store.pages[0].assets.forEach(a=>{delete data(a).generatedFlow})
    expect(store.currentPageCanvasHeight).toBe(store.pageHeight)
  })
  it('учень/Replay на вузькому екрані не перекриває записаний наступний ряд',()=>{
    const p=page()
    expect(generatedFitPageH(p,p.assets[0],false)).toBe(440)
    expect(generatedFitPageH(p,p.assets[0],true)).toBe(2060)
    expect(generatedFitPageH(p,p.assets[4],false)).toBe(2860)
    expect(generatedFitPageH({...p,assets:[]},p.assets[0],false)).toBeNull()
  })
  it.each([1,2,5])('%i задач: одночасні RAF-виміри не повертають старі y',n=>{
    const store=useWBStore();store.pages=[page(n)]
    const requests=store.pages[0].assets.map(a=>fit(a,820))
    requests.forEach(a=>store.updateAsset(a));flushPendingUpdates()
    noOverlap(store.pages[0]);expect(store.undoStack).toHaveLength(0)
    expect(store.pages[0].assets.map(a=>a.y)).toEqual(Array.from({length:n},(_,i)=>60+Math.floor(i/2)*840))
    expect(store.pages[0].assets.every(a=>!!managedFlow(store.pages[0],a))).toBe(true)
  })
  it.each(['x','y','w','h','rotation','locked','minimized','deleted','marker','height'])(
    'ручне/невалідне %s припиняє весь потік',key=>{
      const p=page();const a=p.assets[1] as unknown as Record<string,unknown>
      if(key==='deleted')p.assets.splice(1,1)
      else if(key==='marker')data(p.assets[1]).generatedFlow={version:99}
      else if(key==='height')p.height=1080
      else a[key]=key==='locked'||key==='minimized'?true:999
      expect(managedFlow(p,p.assets[0])).toBeNull()
      expect(reflowGenerated(p,p.assets[0],fit(p.assets[0],820))).toBeNull()
    })
  it('не рухає сторонній об’єкт і не мігрує стару картку',()=>{
    const p=page();const other={id:'hand',type:'image',src:'x',x:1700,y:300,w:100,h:100} as WBAsset
    p.assets.push(other)
    const next=reflowGenerated(p,p.assets[0],fit(p.assets[0],820))!
    expect(next[next.length-1]).toBe(other)
    delete data(p.assets[0]).generatedFlow
    expect(reflowGenerated(p,p.assets[0],fit(p.assets[0],820))).toBeNull()
  })
  it('розбір → fit → undo → fit → redo лишає одну дію й потік',()=>{
    const store=useWBStore();store.pages=[page()]
    const first=()=>store.pages[0].assets[0]
    store.updateAsset(fit(first(),820));flushPendingUpdates()
    store.updateAsset({...first(),data:{...data(first()),showSolution:true} as unknown as WBAsset['data']});flushPendingUpdates()
    store.updateAsset(fit(first(),1600));flushPendingUpdates();noOverlap(store.pages[0])
    expect(store.undoStack).toHaveLength(1)
    store.undo();flushPendingUpdates();expect(data(first()).showSolution).toBe(false)
    store.updateAsset(fit(first(),820));flushPendingUpdates();expect(store.redoStack).toHaveLength(1)
    store.redo();flushPendingUpdates();expect(data(first()).showSolution).toBe(true)
    store.updateAsset(fit(first(),1600));flushPendingUpdates();noOverlap(store.pages[0])
    expect(managedFlow(store.pages[0],first())).not.toBeNull()
  })
  it('пізній height-запит не стирає новий текст',()=>{
    const store=useWBStore();store.pages=[page()];const before=store.pages[0].assets[0]
    store.updateAsset(fit(before,820))
    store.pages[0].assets[0]={...before,data:{...data(before),question:'Нове'} as WBAsset['data']}
    flushPendingUpdates();expect(data(store.pages[0].assets[0]).question).toBe('Нове')
  })
  it('reload і Replay відтворюють ті самі asset_update без нового writer',()=>{
    const store=useWBStore();store.pages=[page()];const initial=JSON.parse(JSON.stringify(store.pages))
    const ops:unknown[]=[];store.onOperation(op=>ops.push(JSON.parse(JSON.stringify(op))))
    store.pages[0].assets.map(a=>fit(a,820)).forEach(a=>store.updateAsset(a));flushPendingUpdates()
    const final=JSON.stringify(store.pages)
    store.pages=JSON.parse(final);expect(managedFlow(store.pages[0],store.pages[0].assets[0])).not.toBeNull()
    store.setMode('replay');store.pages=initial
    for(const op of ops)applyReplayOperation(store as never,op as never)
    expect(JSON.stringify(store.pages)).toBe(final);noOverlap(store.pages[0])
    expect(ops.every((op:any)=>op.op_type==='asset_update')).toBe(true)
    expect(flowOf(store.pages[0].assets[4])?.y).toBe(1740)
  })
})
