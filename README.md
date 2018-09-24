# Gestión de autorizaciones
## Proyecto de la aplicación web

Para poder ver el sitio web es necesario hacer lo siguiente:

 1. Abrir una consola en la raíz del proyecto.

 2. Instalar todas las dependencias: `npm install`

 3. Levantar el servidor de prueba: `npm start`
 
 4. Abrir un navegador en la url: http://localhost:9300/
 
 5. Si nada más se desea hacer el build del proyecto, tiene que ejecutar: `npm run build` 

## Configuración
### Dirección del API que consume
Por defecto el sitio web hace los requests a la dirección: http://localhost:44494/api.  Esto se puede cambiar en el archivo **app.conf.json**. Ejemplo:

    {
	    "url": "http://192.168.57.101:44494/api"
    }
Si se está ejecutando el servidor de prueba en ese momento automáticamente volverá a cargar la página. En caso contrario, se debe hacer el build de nuevo para que coja los cambios.

### Host y puerto del servidor de prueba
La configuración del servidor de prueba se encuentra en el archivo **webpack.config.js**.  El cambio se debe hacer en dos lugares:

    config.output = {
	    ...
	    // Esta propiedad define dónde se van a buscar los assets
	    publicPath: 'http://localhost:9300/',
	    ...
    }
y, al final de ese archivo:

    config.devServer = {  
      ...
      host: 'localhost',  
      port: 9300  
    };