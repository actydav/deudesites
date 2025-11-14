// Este archivo es para Netlify Functions si decides desplegar en Netlify
// Puedes omitirlo si solo usas GitHub Pages

exports.handler = async function(event, context) {
    // Para Netlify Functions - procesamiento de webhooks o APIs
    // Por ahora lo dejamos vacío ya que todo funciona con Firebase directamente
    
    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Función de pago simulada" })
    };
}