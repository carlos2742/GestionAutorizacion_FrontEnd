# Pasos para desplegar frontend de autorizaciones

## Generar build del proyecto

Debe ejecutarse: `npm run build`

## Constantes de configuración

Estas constantes se definen en el archivo `app.conf.json`. 

### url

````json
{
    "url": "http://localhost:44494/api",
    ...
}
````

El valor de esta variable es la URL donde se está ejecutando el backend de **Autorizaciones**. La URL debe incluir **/api**.  
**NOTA:** La URL del backend debe estar con `HTTPS` si al front end se está accediendo por `HTTPS`.

### formatoFechas

````json
{
    ...
    "formatoFechas": "DD/MM/YYYY",
    ...
}
````

Formato que deben tener las fechas que se muestran en la aplicación. El que está puesto por defecto equivale a: 24/12/2018.

### elementosPorPagina

````json
{
    ...
    "elementosPorPagina": 25,
    ...
}
````

Cantidad máxima de filas que se muestran en las tablas que tienen paginación.

### elementosPorPaginaParaExcel

````json
{
    ...
    "elementosPorPaginaParaExcel": 25,
    ...
}
````

Cantidad máxima de entidades que se piden en cada request al backend cuando se está generando el Excel con su información.

### elementosBusquedaSelect

````json
{
    ...
    "elementosBusquedaSelect": 50,
    ...
}
````

Cantidad máxima de elementos que sale en los combo box que tienen paginación (como el de personal).

### etiquetaPorDefectoAutorizada

````json
{
    ...
    "etiquetaPorDefectoAutorizada": "Aprobada",
    ...
}
````

Texto que se muestra para peticiones que están Aprobadas pero no existe una etiqueta definida para ellas.

### etiquetaPorDefectoRechazada

````json
{
    ...
    "etiquetaPorDefectoRechazada": "Rechazada",
    ...
}
````

Texto que se muestra para peticiones que están Rechazadas pero no existe una etiqueta definida para ellas.

### etiquetaPorDefectoPendiente

````json
{
    ...
    "etiquetaPorDefectoPendiente": "Pendiente",
    ...
}
````

Texto que se muestra para peticiones que están Pendientes pero no existe una etiqueta definida para ellas.

### etiquetaPorDefectoEnRevision

````json
{
    ...
    "etiquetaPorDefectoEnRevision": "En Revisión",
    ...
}
````

Texto que se muestra para peticiones que están En Revisión pero no existe una etiqueta definida para ellas.

### etiquetaPorDefectoAnulada

````json
{
    ...
    "etiquetaPorDefectoAnulada": "Anulada",
    ...
}
````

Texto que se muestra para peticiones que están Anuladas.

### urlEnlaceCalendarios

````json
{
    ...
    "urlEnlaceCalendarios": "http://localhost:9400/#/mi-calendario?usuario=<usuario>&anno=<anno>",
    ...
}
````

URL usada para construir los enlaces a la aplicación de Calendarios de peticiones relacionadas con dicha aplicación. Se debe cambiar la URL hasta antes del # y mantener el final igual.

### idCalendarios

````json
{
    ...
    "idCalendarios": "3"
}
````

ID de la aplicación de Calendarios en la BD de Autorizaciones.

## IIS

El frontend de autorizaciones debe tener habilitado **Autenticación por Windows** y la **Autenticación Anónima**.