import { describe, expect, it } from 'vitest';
import { visitaObservada } from './visitas-observadas.js';
const pin={facturaId:'f1',localId:'l1',lat:-33.5,lng:-70.7};
const p=(s:number,lat=pin.lat,precisionM=10)=>({lat,lng:pin.lng,precisionM,tomadoEn:new Date(s*1000)});
describe('visitas GPS sin confirmar entrega',()=>{
 it('detecta permanencia y avance sin adjudicar resultado comercial',()=>{expect(visitaObservada([p(0),p(50),p(80,-33.51),p(100,-33.52)],pin,[pin])?.estado).toBe('sin_confirmar');});
 it('no infiere salida con un único salto ni llegada por pasar o sin precisión',()=>{expect(visitaObservada([p(0),p(50),p(80,-33.51)],pin,[pin])?.estado).toBe('en_local');expect(visitaObservada([p(0)],pin,[pin])).toBeUndefined();expect(visitaObservada([p(0,pin.lat,100),p(50,pin.lat,100)],pin,[pin])).toBeUndefined();});
 it('no adjudica una visita a dos comercios vecinos ambiguos',()=>{expect(visitaObservada([p(0),p(50)],pin,[pin,{...pin,localId:'otro',facturaId:'f2'}])).toBeUndefined();});
});
