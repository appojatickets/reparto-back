/** Error de negocio con código estable (para la API) y mensaje en español (para la persona). */
export type ErrorDominio = { readonly codigo: string; readonly mensaje: string };

export const errorDominio = (codigo: string, mensaje: string): ErrorDominio => ({ codigo, mensaje });
