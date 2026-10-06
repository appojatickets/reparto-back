import { describe, expect, it, vi } from 'vitest';
import type { ResolvedorEnlaces } from '../ports/out/enlaces.js';
import { usuarioDe } from './fakes.test-util.js';
import { fakeClientes, fakePines, localDe } from './fakes-clientes.test-util.js';
import { crearFijarPinDesdeEnlace } from './pin-desde-enlace.js';

const chofer = usuarioDe({ id: 'u-ch', rol: 'chofer' });
const LARGO = 'https://maps.google.com/?q=-33.5972,-70.7019';
const CORTO = 'Ubicación https://maps.app.goo.gl/AbC123';

const armar = (local = localDe(), larga: string | null = LARGO) => {
  const clientes = fakeClientes([local]);
  const pines = fakePines();
  const resolver = vi.fn<ResolvedorEnlaces['resolver']>(() => Promise.resolve(larga === null ? undefined : { url: larga }));
  return { clientes, pines, resolver, caso: crearFijarPinDesdeEnlace({ clientes, pines, resolvedor: { resolver } }) };
};

describe('pin desde un enlace compartido', () => {
  it('un enlace largo fija el pin como validado, fuente enlace, sin salir a internet', async () => {
    const { caso, clientes, resolver } = armar();
    const r = await caso(chofer, 'l-1', LARGO);
    expect(r).toEqual({ ok: true, value: { resultado: 'fijado', lat: -33.5972, lng: -70.7019 } });
    expect(clientes.actualizarLocal).toHaveBeenCalledWith('empresa-1', 'l-1', { pin: { lat: -33.5972, lng: -70.7019, estado: 'validado', fuente: 'enlace' } });
    expect(resolver).not.toHaveBeenCalled();
  });

  it('un enlace corto se abre con el resolvedor y se lee la dirección larga', async () => {
    const { caso, resolver } = armar();
    const r = await caso(chofer, 'l-1', CORTO);
    expect(r.ok && r.value.resultado).toBe('fijado');
    expect(resolver).toHaveBeenCalledWith('https://maps.app.goo.gl/AbC123');
  });

  it('si la dirección larga no trae el punto pero la página del lugar sí, lo lee de la página', async () => {
    const { caso, resolver } = armar();
    resolver.mockResolvedValueOnce({ url: 'https://www.google.com/maps/place/Los+Tilos+265/data=!4m2!3m1!1s0x9662d:0xabc', cuerpo: '<meta content="https://maps.google.com/maps/api/staticmap?center=-33.6102%2C-70.5758">' });
    const r = await caso(chofer, 'l-1', 'https://maps.app.goo.gl/tQsDTWhhRh9eyaTC8');
    expect(r).toEqual({ ok: true, value: { resultado: 'fijado', lat: -33.6102, lng: -70.5758 } });
  });

  it('si se abrió el enlace pero no trae el punto en ninguna parte, explica qué hacer (dejar un pin en Google Maps)', async () => {
    const { caso, clientes, resolver } = armar();
    resolver.mockResolvedValueOnce({ url: 'https://www.google.com/maps/place/Los+Tilos+265', cuerpo: '<html>sin datos</html>' });
    const r = await caso(chofer, 'l-1', 'https://maps.app.goo.gl/tQsDTWhhRh9eyaTC8');
    expect(!r.ok && r.error.codigo).toBe('VALIDACION');
    expect(!r.ok && r.error.mensaje).toContain('mantén apretado');
    expect(clientes.actualizarLocal).not.toHaveBeenCalled();
  });

  it('un enlace corto que no se puede abrir, o de otro sitio, es VALIDACION y no toca nada', async () => {
    const sinRespuesta = armar(localDe(), null);
    const a = await sinRespuesta.caso(chofer, 'l-1', CORTO);
    expect(!a.ok && a.error.codigo).toBe('VALIDACION');
    const ajeno = armar();
    const b = await ajeno.caso(chofer, 'l-1', 'https://evil.example.com/x');
    expect(!b.ok && b.error.codigo).toBe('VALIDACION');
    expect(ajeno.resolver).not.toHaveBeenCalled();
    expect(sinRespuesta.clientes.actualizarLocal).not.toHaveBeenCalled();
  });

  it('un local inexistente es NO_ENCONTRADO', async () => {
    const { caso } = armar();
    const r = await caso(chofer, 'otro', LARGO);
    expect(!r.ok && r.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('reemplaza un pin sugerido (de un chofer o del geocodificador) y uno que ya vino de un enlace', async () => {
    for (const local of [localDe({ lat: -33.5, lng: -70.6, pinEstado: 'sugerido', pinFuente: 'chofer' }), localDe({ lat: -33.5, lng: -70.6, pinEstado: 'validado', pinFuente: 'enlace' })]) {
      const { caso, pines } = armar(local);
      const r = await caso(chofer, 'l-1', LARGO);
      expect(r.ok && r.value.resultado).toBe('fijado');
      expect(pines.crearLote).not.toHaveBeenCalled();
    }
  });

  it('un pin validado por una persona NO se pisa: queda como propuesta con la distancia', async () => {
    const { caso, clientes, pines } = armar(localDe({ lat: -33.5972, lng: -70.7119, pinEstado: 'validado', pinFuente: 'manual' }));
    const r = await caso(chofer, 'l-1', LARGO);
    expect(r).toEqual({ ok: true, value: { resultado: 'propuesto', lat: -33.5972, lng: -70.7019 } });
    expect(clientes.actualizarLocal).not.toHaveBeenCalled();
    const [empresa, proponente, propuestas] = pines.crearLote.mock.calls[0] ?? [];
    expect([empresa, proponente]).toEqual(['empresa-1', 'u-ch']);
    expect(propuestas?.[0]).toMatchObject({ localId: 'l-1', direccion: 'Av. Providencia 1234', estado: 'pendiente' });
    expect(propuestas?.[0]?.distanciaActualM).toBeGreaterThan(900);
  });
});
