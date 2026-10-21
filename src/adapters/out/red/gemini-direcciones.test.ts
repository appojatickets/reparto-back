import { describe, expect, it, vi } from 'vitest';
import { crearGeminiDirecciones } from './gemini-direcciones.js';
const cuerpo = (direccion: unknown) => ({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify({ direccion }) }] }] });
const json = (x: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(x), { status }));
describe('asistencia opcional de Gemini para direcciones', () => {
  it('envía solo dirección/comuna, mantiene la clave en cabecera y reutiliza la respuesta', async () => {
    const buscar = vi.fn<typeof fetch>(() => json(cuerpo("Avenida Libertador Bernardo O'Higgins 955")));
    const ia = crearGeminiDirecciones({ clave: 'clave-de-prueba', buscar });
    expect(await ia.normalizar('OHigins 955', 'San Bernardo')).toBe("Avenida Libertador Bernardo O'Higgins 955");
    await ia.normalizar('OHigins 955', 'San Bernardo');
    expect(buscar).toHaveBeenCalledOnce();
    const [url, init] = buscar.mock.calls[0] ?? [];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(url).not.toContain('clave-de-prueba');
    expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'clave-de-prueba' });
    const peticion = JSON.parse(init?.body as string) as { store: boolean; model: string; input: string };
    expect(peticion.store).toBe(false); expect(peticion.model).toBe('gemini-3.5-flash-lite');
    expect(JSON.parse(peticion.input)).toEqual({ direccion: 'OHigins 955', comuna: 'San Bernardo', pais: 'Chile' });
  });
  it('rechaza números inventados, texto idéntico, instrucciones y respuestas mal formadas', async () => {
    for (const salida of ['OHiggins 9550', 'OHigins 955', '<script>955</script>', null, 123]) {
      const ia = crearGeminiDirecciones({ clave: 'prueba', buscar: vi.fn(() => json(cuerpo(salida))) });
      expect(await ia.normalizar('OHigins 955', 'San Bernardo')).toBeUndefined();
    }
    for (const respuesta of [{}, { steps: [{ type: 'thought', content: [{ type: 'text', text: '{"direccion":"OHiggins 955"}' }] }] }, { steps: [{ type: 'model_output', content: [{ type: 'text', text: 'no es JSON' }] }] }]) {
      expect(await crearGeminiDirecciones({ clave: 'prueba', buscar: vi.fn(() => json(respuesta)) }).normalizar('OHigins 955', 'San Bernardo')).toBeUndefined();
    }
  });
  it('respeta el límite local y vuelve a permitir consultas al día siguiente', async () => {
    let instante = 0;
    const buscar = vi.fn<typeof fetch>(() => json(cuerpo(null)));
    const ia = crearGeminiDirecciones({ clave: 'prueba', buscar, limiteDiario: 1, ahora: () => instante });
    await ia.normalizar('Calle Uno 1', 'Maipú'); await ia.normalizar('Calle Dos 2', 'Maipú');
    expect(buscar).toHaveBeenCalledOnce();
    instante = 86_400_001;
    await ia.normalizar('Calle Dos 2', 'Maipú');
    expect(buscar).toHaveBeenCalledTimes(2);
  });
  it('una cuota agotada o clave inválida pausa consultas durante una hora, sin lanzar errores', async () => {
    for (const status of [401, 403, 404, 429]) {
      let instante = 0;
      const buscar = vi.fn<typeof fetch>(() => json({}, status));
      const ia = crearGeminiDirecciones({ clave: 'prueba', buscar, ahora: () => instante });
      await ia.normalizar('Calle Uno 1', 'Maipú'); await ia.normalizar('Calle Dos 2', 'Maipú');
      expect(buscar).toHaveBeenCalledOnce();
      instante = 3_600_001; await ia.normalizar('Calle Dos 2', 'Maipú');
      expect(buscar).toHaveBeenCalledTimes(2);
    }
  });
  it('la red caída y un servidor con error no bloquean la ruta', async () => {
    for (const buscar of [vi.fn<typeof fetch>(() => Promise.reject(new Error('sin red'))), vi.fn<typeof fetch>(() => json({}, 500))]) {
      const ia = crearGeminiDirecciones({ clave: 'prueba', buscar });
      expect(await ia.normalizar('Calle Uno 1', 'Maipú')).toBeUndefined();
      expect(await ia.normalizar('Calle Dos 2', 'Maipú')).toBeUndefined();
      expect(buscar).toHaveBeenCalledOnce();
    }
  });
});
