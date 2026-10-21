import { describe, expect, it, vi } from 'vitest';
import { crearGeminiPines } from './gemini-pines.js';
const pin = { lat: -33.6, lng: -70.7, precision: 'exacta' as const, comuna: 'San Bernardo', direccion: 'OHiggins 955' };
const funcion = (direccion = 'OHiggins 955') => ({ type: 'function_call', id: 'call-1', name: 'buscar_mapa', arguments: { direccion } });
const final = (candidato: unknown) => ({ type: 'model_output', content: [{ type: 'text', text: JSON.stringify({ candidato }) }] });
const respuesta = (...steps: unknown[]) => new Response(JSON.stringify({ status: 'completed', steps }));
const opciones = { clave: 'prueba', modelo: 'gemini-3.5-flash-lite', limiteDiario: 50 };

describe('Gemini busca pines mediante una herramienta de mapas', () => {
  it('ejecuta la búsqueda, devuelve solo el candidato real y conserva el historial sin guardar la interacción', async () => {
    const buscar = vi.fn<typeof fetch>().mockResolvedValueOnce(respuesta(funcion())).mockResolvedValueOnce(respuesta(final('mapa-1')));
    const mapa = vi.fn(() => Promise.resolve(pin));
    const ia = crearGeminiPines({ ...opciones, buscar });
    expect(await ia.buscar('OHigins 955', 'San Bernardo', mapa)).toEqual(pin);
    expect(mapa).toHaveBeenCalledExactlyOnceWith('OHiggins 955');
    const segunda = JSON.parse(buscar.mock.calls[1]?.[1]?.body as string) as { store: boolean; input: unknown[] };
    expect(segunda.store).toBe(false);
    expect(segunda.input).toContainEqual(funcion());
    expect(segunda.input).toContainEqual(expect.objectContaining({ type: 'function_result', call_id: 'call-1' }));
    await ia.buscar('OHigins 955', 'San Bernardo', mapa);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it.each(['OHiggins 9550', 'Otro Camino 955', '<script>955</script>'])('no busca una dirección cambiada: %s', async (direccion) => {
    const buscar = vi.fn<typeof fetch>().mockResolvedValueOnce(respuesta(funcion(direccion))).mockResolvedValueOnce(respuesta(final('mapa-1')));
    const mapa = vi.fn(() => Promise.resolve(pin));
    expect(await crearGeminiPines({ ...opciones, buscar }).buscar('OHigins 955', 'San Bernardo', mapa)).toBeUndefined();
    expect(mapa).not.toHaveBeenCalled();
  });

  it('no acepta coordenadas inventadas ni un ID que no vino del mapa', async () => {
    const buscar = vi.fn<typeof fetch>().mockResolvedValueOnce(respuesta(final({ lat: -33.6, lng: -70.7 })));
    expect(await crearGeminiPines({ ...opciones, buscar }).buscar('Calle Uno 10', 'Maipú', vi.fn())).toBeUndefined();
    const falso = vi.fn<typeof fetch>().mockResolvedValueOnce(respuesta(funcion())).mockResolvedValueOnce(respuesta(final('mapa-9')));
    expect(await crearGeminiPines({ ...opciones, buscar: falso }).buscar('OHigins 955', 'San Bernardo', () => Promise.resolve(pin))).toBeUndefined();
  });

  it('respeta cuota, pausas ante errores y el máximo de cuatro turnos aunque la IA siga pidiendo búsquedas', async () => {
    const buscar = vi.fn<typeof fetch>(() => Promise.resolve(respuesta(funcion())));
    const mapa = vi.fn(() => Promise.resolve(undefined));
    expect(await crearGeminiPines({ ...opciones, buscar }).buscar('OHigins 955', 'San Bernardo', mapa)).toBeUndefined();
    expect(buscar).toHaveBeenCalledTimes(4);
    expect(mapa).toHaveBeenCalledOnce();
    const limitado = vi.fn<typeof fetch>(() => Promise.resolve(respuesta(funcion())));
    await crearGeminiPines({ ...opciones, limiteDiario: 1, buscar: limitado }).buscar('OHigins 955', 'San Bernardo', mapa);
    expect(limitado).toHaveBeenCalledOnce();
    const caido = vi.fn<typeof fetch>(() => Promise.resolve(new Response('{}', { status: 429 })));
    const ia = crearGeminiPines({ ...opciones, buscar: caido });
    await ia.buscar('Uno 1', 'Maipú', mapa); await ia.buscar('Dos 2', 'Maipú', mapa);
    expect(caido).toHaveBeenCalledOnce();
  });
});
