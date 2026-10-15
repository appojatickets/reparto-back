import { z } from 'zod';
import type { ResumenAnalisis } from '../../../../application/ports/out/aprendizaje.js';
import { actor } from '../auth.js';
import { RESPUESTAS_ERROR } from '../errores.js';
import { SEGURIDAD, tipada, type ContextoRutas } from './comunes.js';

const etiqueta = z.object({ razonSocial: z.string(), direccion: z.string(), comuna: z.string() });
const parametro = z.object({ clave: z.enum(['ritmo', 'servicio_min', 'capacidad_paradas', 'duracion_jornada_min']), ambito: z.string(), valor: z.number(), muestras: z.number(), confianza: z.number(), camion: z.string().optional() });
const casoCierre = z.object({ tipo: z.enum(['solo_gps', 'solo_boton']), facturaId: z.string(), localId: z.string(), camionId: z.string(), fecha: z.string(), minutos: z.number(), entregadaDespues: z.boolean(), camion: z.string().optional(), etiqueta: etiqueta.optional() });
const cierresGps = z.object({
  visitas: z.number(), atendidas: z.number(), cerradoDeducido: z.number(), sinDesenlace: z.number(), botonCerrado: z.number(), botonSinRecorrido: z.number(), botonSinDesenlace: z.number(),
  coinciden: z.number(), soloGps: z.number(), soloGpsConfirmados: z.number(), soloBoton: z.number(), medianaMinCerradoBoton: z.number().optional(), medianaMinAtendidas: z.number().optional(),
  casos: z.array(casoCierre),
});
const bancoFicha = z.object({
  cierre: z.object({ evaluadas: z.number(), cerradas: z.number(), anticipadas: z.number(), falsasAlarmas: z.number(), aciertos: z.number() }),
  hora: z.object({ evaluadas: z.number(), dentroDelRango: z.number() }),
});
const resumenAnalisis = z.object({
  eventos: z.number(), jornadas: z.number(), parametros: z.number(), jornadasComparadas: z.number(), pinesSugeridos: z.number(), pinesProponidos: z.number(), llegadasDeducidas: z.number(),
  seguimientoRuta: z.object({ entregas: z.number(), primeraDeLaLista: z.number(), conRutaDelSistema: z.number(), primeraDeLaRutaDelSistema: z.number() }),
  cierresFrecuentes: z.array(z.object({ localId: z.string(), cerrados: z.number(), intentos: z.number(), confianzaAbierto: z.number(), horasCerrado: z.array(z.number()) })),
  cierresGps: cierresGps.optional(),
  bancoFicha: bancoFicha.optional(),
});

const resumenAJson = (r: ResumenAnalisis) => ({ eventos: r.eventos, jornadas: r.jornadas, parametros: r.parametros, jornadasComparadas: r.jornadasComparadas, pinesSugeridos: r.pinesSugeridos, pinesProponidos: r.pinesProponidos, llegadasDeducidas: r.llegadasDeducidas, seguimientoRuta: r.seguimientoRuta, cierresFrecuentes: r.cierresFrecuentes.map((c) => ({ ...c, horasCerrado: [...c.horasCerrado] })), ...(r.cierresGps ? { cierresGps: { ...r.cierresGps, casos: [...r.cierresGps.casos] } } : {}), ...(r.bancoFicha ? { bancoFicha: r.bancoFicha } : {}) });

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
            calidad: z.array(z.object({ fecha: z.string(), camionId: z.string(), camion: z.string().optional(), distSugeridaM: z.number(), distRealM: z.number(), inversiones: z.number(), origen: z.enum(['sistema', 'chofer']), cambios: z.number(), entregadas: z.number().optional(), inversionesSalida: z.number().optional(), salioComoSugeria: z.boolean().optional() })),
            aprendido: z.object({
              ritmo: z.array(parametro), capacidad: z.array(parametro), servicioGeneral: parametro.optional(),
              localesLentos: z.array(parametro.extend({ etiqueta: etiqueta.optional() })),
            }),
            cierres: z.array(z.object({ localId: z.string(), cerrados: z.number(), intentos: z.number(), horasCerrado: z.array(z.number()), etiqueta: etiqueta.optional() })),
            pinesDudosos: z.array(z.object({ localId: z.string(), distanciaM: z.number(), visitas: z.number(), fuente: z.string().optional(), etiqueta: etiqueta.optional() })),
            cierresGps: cierresGps.optional(),
            bancoFicha: bancoFicha.optional(),
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
        ...(p.cierresGps ? { cierresGps: { ...p.cierresGps, casos: [...p.cierresGps.casos] } } : {}),
        ...(p.bancoFicha ? { bancoFicha: p.bancoFicha } : {}),
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
