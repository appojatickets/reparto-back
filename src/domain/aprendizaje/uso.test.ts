import { describe, expect, it } from 'vitest';
import type { ParametroAprendido } from './analisis.js';
import { aprendidoParaRuta, MINIMO_MUESTRAS_SERVICIO_LOCAL, SIN_APRENDIZAJE } from './uso.js';
import { SERVICIO_POR_DEFECTO_MIN } from '../ruteo/parametros.js';

const p = (clave: ParametroAprendido['clave'], ambito: string, valor: number, confianza = 0.8, muestras = 10): ParametroAprendido => ({ clave, ambito, valor, muestras, confianza });

describe('qué de lo aprendido usa la ruta', () => {
  it('sin nada aprendido todo queda como antes', () => {
    const a = aprendidoParaRuta([], 'cam-1');
    expect(a.ritmo).toBe(1);
    expect(a.servicioMin('l-1')).toBeUndefined();
    expect(SIN_APRENDIZAJE.ritmo).toBe(1);
  });

  it('el ritmo del camión manda sobre el general, y el general sobre nada', () => {
    const params = [p('ritmo', 'global', 1.3), p('ritmo', 'camion:cam-1', 1.1)];
    expect(aprendidoParaRuta(params, 'cam-1').ritmo).toBe(1.1);
    expect(aprendidoParaRuta(params, 'cam-2').ritmo).toBe(1.3);
  });

  it('lo aprendido con poca confianza no se usa', () => {
    expect(aprendidoParaRuta([p('ritmo', 'global', 1.8, 0.1)], 'cam-1').ritmo).toBe(1);
    expect(aprendidoParaRuta([p('servicio_min', 'local:l-1', 20, 0.1)], 'cam-1').servicioMin('l-1')).toBeUndefined();
  });

  it('el estándar de atención es de 10 minutos por local', () => {
    expect(SERVICIO_POR_DEFECTO_MIN).toBe(10);
  });

  it('el tiempo de atención general que se midió NO cambia la base de 10 minutos (todavía faltan datos)', () => {
    const a = aprendidoParaRuta([p('servicio_min', 'global', 4.8, 0.95, 177)], 'cam-1');
    expect(a.servicioMin('l-1')).toBeUndefined();
  });

  it('el tiempo de un local solo reemplaza la base cuando hay suficientes visitas medidas', () => {
    const pocas = aprendidoParaRuta([p('servicio_min', 'local:l-1', 15, 0.8, MINIMO_MUESTRAS_SERVICIO_LOCAL - 1)], 'cam-1');
    expect(pocas.servicioMin('l-1')).toBeUndefined();
    const suficientes = aprendidoParaRuta([p('servicio_min', 'local:l-1', 15, 0.8, MINIMO_MUESTRAS_SERVICIO_LOCAL)], 'cam-1');
    expect(suficientes.servicioMin('l-1')).toBe(15);
    expect(suficientes.servicioMin('l-2')).toBeUndefined();
  });

  it('los valores se acotan para que un dato raro no desarme la ruta', () => {
    const a = aprendidoParaRuta([p('ritmo', 'global', 2.5), p('servicio_min', 'local:l-1', 90), p('servicio_min', 'local:l-2', 0.2)], 'cam-1');
    expect(a.ritmo).toBe(2);
    expect(a.servicioMin('l-1')).toBe(40);
    expect(a.servicioMin('l-2')).toBe(2);
  });
});
