import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { CodigoError, ErrorApp } from '../../../application/errores.js';

const ESTADO: Record<CodigoError, number> = {
  NO_AUTENTICADO: 401,
  CREDENCIALES_INVALIDAS: 401,
  CUENTA_BLOQUEADA: 429,
  USUARIO_INACTIVO: 403,
  SIN_PERMISO: 403,
  NO_ENCONTRADO: 404,
  CONFLICTO: 409,
  VALIDACION: 422,
  SERVICIO_EXTERNO: 502,
};

export const estadoHttp = (codigo: CodigoError): number => ESTADO[codigo];

/** Forma única de todos los errores de la API. */
export const esquemaError = z.object({ codigo: z.string(), mensaje: z.string(), detalle: z.unknown().optional() });

export const RESPUESTAS_ERROR = {
  400: esquemaError,
  401: esquemaError,
  403: esquemaError,
  404: esquemaError,
  409: esquemaError,
  422: esquemaError,
  429: esquemaError,
  502: esquemaError,
};

export const enviarError = (reply: FastifyReply, e: ErrorApp): FastifyReply =>
  reply.code(estadoHttp(e.codigo)).send({ codigo: e.codigo, mensaje: e.mensaje, ...(e.detalle !== undefined ? { detalle: e.detalle } : {}) });
