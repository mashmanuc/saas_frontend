/** Регресія зі штатного стенду: похідна висота не з'їдає undo/redo вчителя. */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import type { WBAsset } from '../types/winterboard'
import type { NmtTaskData } from '../types/nmtTask'
import { isAutoFitOnlyUpdate } from '../board/state/autoFitHistory'

// Чинний WBAsset.data ще не включає NmtTaskData; місток лише на межі store.
type TaskAsset = Omit<WBAsset, 'data'> & { data: NmtTaskData }
const wb = (value: TaskAsset): WBAsset => value as unknown as WBAsset
const asset = (): TaskAsset => ({ id:'task',type:'nmt_task',src:'',x:60,y:60,w:640,h:380,
  rotation:0,locked:false,data:{version:1,taskType:'single_choice',question:'$x+2=-2$',
    showAnswer:false,showSolution:false} })

beforeEach(() => { flushPendingUpdates();setActivePinia(createPinia()) })

describe('auto-fit — похідне компонування, не дія вчителя', () => {
  it.each(['id','type','x','y','w','rotation','locked','question','showAnswer','presentationScale'])(
    'не маскує зміну %s під авто-висоту', field => {
      const previous=asset()
      const next: TaskAsset={...previous,h:800,data:{...previous.data,autoFitH:800}}
      if (field==='id') next.id='another'
      else if (field==='type') next.type='image'
      else if (field==='locked') next.locked=true
      else if (['x','y','w','rotation'].includes(field)) (next as unknown as Record<string,unknown>)[field]=99
      else next.data={...next.data,[field]:field==='showAnswer'?true:field==='presentationScale'?1.3:'інша умова'}
      expect(isAutoFitOnlyUpdate(wb(previous),wb(next))).toBe(false)
    })

  it('одне undo ховає розбір; наступний auto-fit зберігає redo', () => {
    const store=useWBStore()
    store.pages=[{id:'p',name:'Сторінка',strokes:[],assets:[wb(asset())]}]
    const ops: string[]=[];store.onOperation(op=>ops.push(op.op_type))
    const current=()=>store.pages[0].assets[0] as unknown as TaskAsset
    store.updateAsset(wb({...current(),h:810,data:{...current().data,autoFitH:810}}))
    flushPendingUpdates()
    expect(store.undoStack).toHaveLength(0)
    store.updateAsset(wb({...current(),data:{...current().data,showSolution:true}}))
    flushPendingUpdates()
    store.updateAsset(wb({...current(),h:1020,data:{...current().data,autoFitH:1020}}))
    flushPendingUpdates()
    expect(store.undoStack).toHaveLength(1)
    store.undo();flushPendingUpdates()
    expect(current().data).toMatchObject({showSolution:false})
    store.updateAsset(wb({...current(),h:820,data:{...current().data,autoFitH:820}}))
    flushPendingUpdates()
    expect(store.redoStack).toHaveLength(1)
    store.redo();flushPendingUpdates()
    expect(current().data).toMatchObject({showSolution:true})
    expect(ops).toHaveLength(6)
  })

  it('ручний resize і одночасна зміна вмісту лишаються скасовуваними', () => {
    const store=useWBStore()
    store.pages=[{id:'p',name:'Сторінка',strokes:[],assets:[wb(asset())]}]
    store.updateAsset(wb({...asset(),h:420}));flushPendingUpdates()
    expect(store.undoStack).toHaveLength(1)
    store.updateAsset(wb({...asset(),h:800,data:{...asset().data,autoFitH:800,showSolution:true}}))
    flushPendingUpdates()
    expect(store.undoStack).toHaveLength(2)
  })
})
