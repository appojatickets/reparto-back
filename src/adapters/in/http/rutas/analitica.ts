import { z } from 'zod';
import type { ResumenAnalisis } from '../../../../application/ports/out/aprendizaje.js';
import { actor } from '../auth.js';
import { RESPUESTAS_ERROR } from '../errores.js';
import { SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const etiqueta = z.object({ razonSocial: z.string(), direccion: z.string(), comuna: z.string() });
const parametro = z.object({ clave: z.enum(['ritmo', 'servicio_min', 'capacidad_paradas', 'duracion_jornada_min']), ambito: z.string(), valor: z.number(), muestras: z.number(), confianza: z.number(), camion: z.string().optional() });
const resumenAnalisis = z.object({
  eventos: z.number(), jornadas: z.number(), parametros: z.number(), jornadasComparadas: z.number(), pinesSugeridos: z.number(), pinesProponidos: z.number(), llegadasDeducidas: z.number(),
  cierresFrecuentes: z.array(z.object({ localId: z.string(), cerrados: z.number(), intentos: z.number(), confianzaAbierto: z.number(), horasCerrado: z.array(z.number()) })),
});

const resumenAJson = (r: ResumenAnalisis) => ({ eventos: r.eventos, jornadas: r.jornadas, parametros: r.parametros, jornadasComparadas: r.jornadasComparadas, pinesSugeridos: r.pinesSugeridos, pinesProponidos: r.pinesProponidos, llegadasDeducidas: r.llegadasDeducidas, cierresFrecuentes: r.cierresFrecuentes.map((c) => ({ ...c, horasCerrado: [...c.horasCerrado] })) });

export const rutasAnalitica = ({ app, casos, guard }: ContextoRutas): void => {
  const a = tipada(app);

  a.get(
    '/v1/analitica',
    {
      preHandler: guard('metricas:leer'),
      schema: {
        tags: ['analitica'],
        summary: 'Panel del admin: qué datos se están guardando, qué aprendió el sistema y cuánto se parece la ruta sugerida a la manejada (últimos 30 días)',
        security: SEGURIDAD,
        response: {
          200: z.object({
            desde: z.string(),
            cobertura: z.object({
              jornadas: z.number(), jornadasTerminadas: z.number(), avisos: z.number(), avisosConGps: z.number(), avisosAutomaticos: z.number(), paradasConLlegada: z.number(),
              paradasResueltas: z.number(), puntosGps: z.number(), ultimoPuntoGps: z.string().optional(), operacionesRuta: z.number(), correccionesManuales: z.number(),
            }),
            pines: z.object({ verificados: z.number(), porVerificar: z.number(), sinPin: z.number() }),
            porDia: z.array(z.object({ fecha: z.string(), jornadas: z.number(), atendidas: z.number(), sinHacer: z.number() })),
            calidad: z.array(z.object({ fecha: z.string(), camionId: z.string(), camion: z.string().optional(), distSugeridaM: z.number(), distRealM: z.number(), inversiones: z.number() })),
            aprendido: z.object({
              ritmo: z.array(parametro), capacidad: z.array(parametro), servicioGeneral: parametro.optional(),
              localesLentos: z.array(parametro.extend({ etiqueta: etiqueta.optional() })),
            }),
            cierres: z.array(z.object({ localId: z.string(), cerrados: z.number(), intentos: z.number(), horasCerrado: z.array(z.number()), etiqueta: etiqueta.optional() })),
            pinesDudosos: z.array(z.object({ localId: z.string(), distanciaM: z.number(), visitas: z.number(), fuente: z.string().optional(), etiqueta: etiqueta.optional() })),
            ultimaEjecucion: z.object({ iniciadoEn: z.string(), terminadoEn: z.string(), resumen: resumenAnalisis }).optional(),
          }),
          ...RESPUESTAS_ERROR,
        },
      },
    },
    async (req, reply) => {
      const p = await casos.verAnalitica(actor(req).empresaId);
      const { ultimoPuntoGps, ...cobertura } = p.cobertura;
      const e = p.ultimaEjecucion;
      return reply.send({
        desde: p.desde.toISOString(),
        cobertura: { ...cobertura, ...(ultimoPuntoGps ? { ultimoPuntoGps: ultimoPuntoGps.toISOString() } : {}) },
        pines: p.pines,
        porDia: [...p.porDia],
        calidad: [...p.calidad],
        aprendido: {
          ritmo: [...p.aprendido.ritmo],
          capacidad: [...p.aprendido.capacidad],
          ...(p.aprendido.servicioGeneral ? { servicioGeneral: p.aprendido.servicioGeneral } : {}),
          localesLentos: [...p.aprendido.localesLentos],
        },
        cierres: p.cierres.map((c) => ({ ...c, horasCerrado: [...c.horasCerrado] })),
        pinesDudosos: [...p.pinesDudosos],
        ...(e ? { ultimaEjecucion: { iniciadoEn: e.iniciadoEn.toISOString(), terminadoEn: e.terminadoEn.toISOString(), resumen: resumenAJson(e.resumen) } } : {}),
      });
    },
  );

  a.post(
    '/v1/analitica/ejecutar',
    {
      preHandler: guard('metricas:leer'),
      schema: {
        tags: ['analitica'],
        summary: 'Correr el análisis ahora (normalmente corre solo en segundo plano) y devolver su resumen',
        security: SEGURIDAD,
        response: { 200: resumenAnalisis, ...RESPUESTAS_ERROR },
      },
    },
    async (req, reply) => reply.send(resumenAJson(await casos.ejecutarAnalisis(actor(req).empresaId))),
  );
};
