import fetch from 'node-fetch';

const GEMINI_API_KEY = 'AIzaSyDy0sX_xpT8okD2_xrHsGzs3T6IF-QNu6o';

async function listarModelos() {
  try {
    console.log('🔍 Listando modelos disponíveis...\n');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    const data = await response.json();
    
    if (data.models) {
      console.log('✅ Modelos disponíveis:\n');
      data.models.forEach(model => {
        if (model.name.includes('gemini') && model.supportedGenerationMethods?.includes('generateContent')) {
          console.log(`✅ ${model.name}`);
          console.log(`   Descrição: ${model.displayName}`);
          console.log('');
        }
      });
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

async function testarModelo(modelName) {
  try {
    console.log(`\n🧪 Testando modelo: ${modelName}`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: 'Diga apenas: funcionou!' }] }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      const resposta = data.candidates[0].content.parts[0].text;
      console.log(`✅ SUCESSO! Resposta: ${resposta}`);
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ Falhou: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return false;
  }
}

async function main() {
  await listarModelos();
  
  console.log('\n🧪 ====================================');
  console.log('🧪 TESTANDO MODELOS');
  console.log('🧪 ====================================\n');
  
  const modelosParaTestar = [
    'models/gemini-1.5-flash',
    'models/gemini-1.5-flash-latest',
    'models/gemini-1.5-pro',
    'models/gemini-1.5-pro-latest',
    'models/gemini-pro',
    'models/gemini-2.0-flash-exp'
  ];
  
  for (const modelo of modelosParaTestar) {
    await testarModelo(modelo);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay de 1s entre testes
  }
}

main();