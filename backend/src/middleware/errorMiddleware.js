/*
 * CloudBox - Manejo Global de Errores
 *
 * Este middleware centraliza el manejo de errores del backend.
 *
 * Su objetivo es evitar que cada controlador tenga que
 * manejar las respuestas de error de manera diferente.
 *
 * Debe proporcionar respuestas consistentes al frontend.
 *
 * Los errores internos no deben exponer información sensible
 * de la aplicación o de la base de datos.
 */