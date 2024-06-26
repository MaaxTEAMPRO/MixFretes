const openRouteServiceKey = '5b3ce3597851110001cf6248a7350e10fe0047d5b435df18da0ca0ab';
const openWeatherMapKey = '882a7c86ee232f1f5a53433800f48151';

function saveToLocalStorage() {
    const formElements = document.querySelectorAll('#freteForm input, #freteForm checkbox');
    formElements.forEach(element => {
        localStorage.setItem(element.id, element.type === 'checkbox' ? element.checked : element.value);
    });
}

function loadFromLocalStorage() {
    const formElements = document.querySelectorAll('#freteForm input, #freteForm checkbox');
    formElements.forEach(element => {
        if (localStorage.getItem(element.id) !== null) {
            if (element.type === 'checkbox') {
                element.checked = localStorage.getItem(element.id) === 'true';
            } else {
                element.value = localStorage.getItem(element.id);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', loadFromLocalStorage);
document.getElementById('freteForm').addEventListener('input', saveToLocalStorage);

async function calcularFrete() {
    limparMensagensErro(); // Limpar mensagens de erro ao iniciar novo cálculo

    const cidadeOrigem = document.getElementById('cidadeOrigem').value.trim();
    const cidadeDestino = document.getElementById('cidadeDestino').value.trim();
    const mediaConsumo = parseFloat(document.getElementById('mediaConsumo').value);
    const custoDiesel = parseFloat(document.getElementById('custoDiesel').value);
    const valorFrete = parseFloat(document.getElementById('valorFrete').value);
    const adicionarVolta = document.getElementById('adicionarVolta').checked;
    const seguroImprevistos = 200;

    if (!cidadeOrigem || !cidadeDestino || isNaN(mediaConsumo) || isNaN(custoDiesel) || isNaN(valorFrete)) {
        exibirMensagemErro('Por favor, preencha todos os campos corretamente.');
        return;
    }

    const origemCoords = await geocodificarCidade(cidadeOrigem);
    const destinoCoords = await geocodificarCidade(cidadeDestino);

    if (!origemCoords || !destinoCoords) {
        exibirMensagemErro('Cidade de origem ou destino não encontrada.');
        return;
    }

    const distanciaKm = await calcularDistanciaRodoviaria(origemCoords, destinoCoords);
    if (distanciaKm !== null) {
        exibirCabecalhoResultado(cidadeOrigem, cidadeDestino);
        calcularCustos(distanciaKm, mediaConsumo, custoDiesel, valorFrete, seguroImprevistos, adicionarVolta);
        await exibirPrevisaoCompleta(cidadeOrigem, 'origem');
        await exibirPrevisaoCompleta(cidadeDestino, 'destino');

        const velocidadeMedia = 38; // Velocidade média em km/h
        let tempoViagemHoras = Math.floor(distanciaKm / velocidadeMedia); // Horas completas
        let tempoViagemMinutos = Math.round((distanciaKm / velocidadeMedia - tempoViagemHoras) * 60); // Minutos restantes

        if (adicionarVolta) {
            tempoViagemHoras *= 2;
            tempoViagemMinutos *= 2;

            if (tempoViagemMinutos >= 60) {
                tempoViagemHoras += Math.floor(tempoViagemMinutos / 60);
                tempoViagemMinutos = tempoViagemMinutos % 60;
            }
        }

        const tempoViagemText = `Tempo de Viagem: ${tempoViagemHoras} horas e ${tempoViagemMinutos} minutos`;
        document.getElementById('tempoViagem').innerText = tempoViagemText;

    } else {
        exibirMensagemErro('Erro ao calcular a distância.');
    }
}

function exibirCabecalhoResultado(origem, destino) {
    const cabecalho = `${origem.toUpperCase()} X ${destino.toUpperCase()}`;
    document.getElementById('cityNames').innerText = cabecalho;
}

function exibirMensagemErro(mensagem) {
    const errorMessageElement = document.getElementById('error-message');
    errorMessageElement.innerText = mensagem;
    errorMessageElement.style.display = 'block';
}

function limparMensagensErro() {
    const errorMessageElement = document.getElementById('error-message');
    errorMessageElement.style.display = 'none';
    errorMessageElement.innerText = '';
}

async function geocodificarCidade(cidade) {
    const urlGeocode = `https://api.openrouteservice.org/geocode/search?api_key=${openRouteServiceKey}&text=`;
    const response = await fetch(`${urlGeocode}${encodeURIComponent(cidade)}`);

    if (!response.ok) {
        console.error('Erro na requisição de geocodificação:', response.statusText);
        return null;
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
        return data.features[0].geometry.coordinates;
    } else {
        console.error('Cidade não encontrada:', cidade);
        return null;
    }
}

async function calcularDistanciaRodoviaria(origemCoords, destinoCoords) {
    const urlRoute = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${openRouteServiceKey}`;
    const body = JSON.stringify({
        coordinates: [origemCoords, destinoCoords]
    });

    const response = await fetch(urlRoute, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: body
    });

    if (!response.ok) {
        console.error('Erro na requisição de roteamento:', response.statusText);
        return null;
    }

    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
        return data.routes[0].summary.distance / 1000; // Convertendo metros para quilômetros
    } else {
        console.error('Rota não encontrada.');
        return null;
    }
}

function calcularCustos(distanciaKm, mediaConsumo, custoDiesel, valorFrete, seguroImprevistos, adicionarVolta) {
    if (adicionarVolta) {
        distanciaKm *= 2; // Duplicar a distância se adicionar volta
    }
    const custoComDiesel = (distanciaKm / mediaConsumo) * custoDiesel;
    const custoComManutencao = distanciaKm * 0.32; // Custo aproximado de manutenção por km
    const custoComPneus = distanciaKm * 0.58; // Custo de manutenção de pneus por km
    const valorTotalDespesas = custoComDiesel + custoComManutencao + custoComPneus + seguroImprevistos;
    const lucroPrejuizo = valorFrete - valorTotalDespesas;
    const lucroPorKm = lucroPrejuizo / distanciaKm;

    const lpkmIdeal = distanciaKm <= 400 ? 2.5 : 2.0;
    const freteIdeal = valorTotalDespesas + (lpkmIdeal * distanciaKm);

    document.getElementById('precoFrete').innerText = `Preço do Frete: R$ ${valorFrete.toFixed(2)}`;
    document.getElementById('distancia').innerText = `Distância: ${distanciaKm.toFixed(2)} km`;
    document.getElementById('custoDieselResultado').innerText = `Custo com Diesel: R$ ${custoComDiesel.toFixed(2)}`;
    document.getElementById('custoManutencao').innerText = `Custo com Manutenção: R$ ${custoComManutencao.toFixed(2)}`;
    document.getElementById('custoPneus').innerText = `Custo com Pneus: R$ ${custoComPneus.toFixed(2)}`;
    document.getElementById('seguroImprevistos').innerText = `Seguro de Imprevistos: R$ ${seguroImprevistos.toFixed(2)}`;
    document.getElementById('valorTotalDespesas').innerText = `Valor Total de Despesas: R$ ${valorTotalDespesas.toFixed(2)}`;
    document.getElementById('lucroPorKm').innerText = `Lucro por Quilômetro: R$ ${lucroPorKm.toFixed(2)}`;
    document.getElementById('freteIdeal').innerText = `Frete Ideal/Cotação: R$ ${freteIdeal.toFixed(2)}`;

    const lucroPrejuizoElement = document.getElementById('lucroPrejuizo');
    lucroPrejuizoElement.innerText = lucroPrejuizo >= 0 
        ? `Lucro: R$ ${lucroPrejuizo.toFixed(2)}`
        : `Prejuízo: R$ ${Math.abs(lucroPrejuizo).toFixed(2)}`;
    lucroPrejuizoElement.className = `result-item ${lucroPrejuizo >= 0 ? 'positivo' : 'negativo'}`;

    document.getElementById('resultado').style.display = 'block';
}

function copiarResultado() {
    const cityNames = document.getElementById('cityNames').innerText.trim();
    const adicionarVolta = document.getElementById('adicionarVolta').checked ? 'Sim' : 'Não';
    const distancia = document.getElementById('distancia').innerText.trim();
    const custoDieselResultado = document.getElementById('custoDieselResultado').innerText.trim();
    const custoManutencao = document.getElementById('custoManutencao').innerText.trim();
    const custoPneus = document.getElementById('custoPneus').innerText.trim();
    const seguroImprevistos = document.getElementById('seguroImprevistos').innerText.trim();
    const valorTotalDespesas = document.getElementById('valorTotalDespesas').innerText.trim();
    const lucroPorKm = document.getElementById('lucroPorKm').innerText.trim();
    const freteIdeal = document.getElementById('freteIdeal').innerText.trim();
    const lucroPrejuizo = document.getElementById('lucroPrejuizo').innerText.trim();
    const weatherOrigem = document.getElementById('weatherOrigem').innerText.trim();
    const weatherDestino = document.getElementById('weatherDestino').innerText.trim();
    const tempoViagem = document.getElementById('tempoViagem').innerText.trim();

    const resultadoText = `
${cityNames}
Container ida+volta: ${adicionarVolta}

${weatherOrigem}
${weatherDestino}

${distancia}
${tempoViagem}
${custoDieselResultado}
${custoManutencao}
${custoPneus}
${seguroImprevistos}
${valorTotalDespesas}
${lucroPorKm}
${freteIdeal}

${lucroPrejuizo}
    `;

    const textArea = document.createElement('textarea');
    textArea.value = resultadoText.trim();
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('Resultado copiado para a área de transferência!');
}

async function exibirPrevisaoCompleta(cidade, tipo) {
    const urlWeather = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cidade)}&appid=${openWeatherMapKey}&units=metric&lang=pt_br`;
    const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(cidade)}&appid=${openWeatherMapKey}&units=metric&lang=pt_br`;

    try {
        // Previsão do tempo atual
        const responseWeather = await fetch(urlWeather);
        if (!responseWeather.ok) {
            throw new Error('Erro na requisição da previsão do tempo: ' + responseWeather.statusText);
        }

        const dataWeather = await responseWeather.json();
        const weather = dataWeather.weather[0].main.toLowerCase();
        const tempAtual = dataWeather.main.temp.toFixed(1);
        const tempMin = dataWeather.main.temp_min.toFixed(1);

        let tempMaxPrevista = Number.MIN_SAFE_INTEGER; // Inicializa com um valor muito negativo

        // Verifica se há temperatura máxima disponível na resposta atual
        if (dataWeather.main.temp_max !== undefined) {
            tempMaxPrevista = dataWeather.main.temp_max;
        }

        let weatherEmoji;
        let weatherDescription;
        switch (weather) {
            case 'clear':
                weatherEmoji = '☀️';
                weatherDescription = 'Sol';
                break;
            case 'clouds':
                weatherEmoji = '🌥️';
                weatherDescription = 'Nublado';
                break;
            case 'thunderstorm':
                weatherEmoji = '⛈️';
                weatherDescription = 'Chuva Com Trovão';
                break;
            case 'drizzle':
                weatherEmoji = '🌧️';
                weatherDescription = 'Garoa';
                break;
            case 'rain':
                weatherEmoji = '🌧️';
                weatherDescription = 'Chuva';
                break;
            case 'snow':
                weatherEmoji = '🌨️';
                weatherDescription = 'Neve';
                break;
            case 'mist':
            case 'fog':
                weatherEmoji = '🌫️';
                weatherDescription = 'Nevoeiro';
                break;
            case 'haze':
                weatherEmoji = '🌫️';
                weatherDescription = 'Neblina';
                break;
            case 'smoke':
                weatherEmoji = '🌫️';
                weatherDescription = 'Fumaça';
                break;
            case 'dust':
                weatherEmoji = '🌫️';
                weatherDescription = 'Poeira';
                break;
            case 'sand':
                weatherEmoji = '🌫️';
                weatherDescription = 'Areia';
                break;
            case 'ash':
                weatherEmoji = '🌫️';
                weatherDescription = 'Cinzas';
                break;
            case 'squall':
                weatherEmoji = '🌪️';
                weatherDescription = 'Tempestade';
                break;
            case 'tornado':
                weatherEmoji = '🌪️';
                weatherDescription = 'Tornado';
                break;
            default:
                weatherEmoji = '☁️';
                weatherDescription = 'Nublado';
                break;
        }

        // Previsão de chuva
        const responseForecast = await fetch(urlForecast);
        if (!responseForecast.ok) {
            throw new Error('Erro na requisição da previsão de chuva: ' + responseForecast.statusText);
        }

        const dataForecast = await responseForecast.json();
        let proximaChuva = 'sem previsão de chuva';

        for (let i = 0; i < dataForecast.list.length; i++) {
            const chuva = dataForecast.list[i].rain ? dataForecast.list[i].rain['3h'] : 0;
            if (chuva > 1) { // Considerar apenas chuvas com mais de 1mm
                let horaChuva = '';
                const dataHoraChuva = new Date(dataForecast.list[i].dt_txt);
                if (dataHoraChuva.toDateString() === new Date().toDateString()) {
                    horaChuva = `Próxima chuva hoje às ${dataHoraChuva.getHours().toString().padStart(2, '0')}:${dataHoraChuva.getMinutes().toString().padStart(2, '0')} (${chuva}mm)`;
                } else {
                    const dia = dataHoraChuva.getDate().toString().padStart(2, '0');
                    const mes = (dataHoraChuva.getMonth() + 1).toString().padStart(2, '0');
                    const ano = dataHoraChuva.getFullYear();
                    const horas = dataHoraChuva.getHours().toString().padStart(2, '0');
                    const minutos = dataHoraChuva.getMinutes().toString().padStart(2, '0');
                    horaChuva = `Próxima chuva em ${dia}/${mes}/${ano} às ${horas}:${minutos} (${chuva}mm)`;
                }
                proximaChuva = horaChuva;
                break;
            }

            // Verificar e atualizar temperatura máxima prevista
            if (dataForecast.list[i].main.temp_max !== undefined) {
                tempMaxPrevista = Math.max(tempMaxPrevista, dataForecast.list[i].main.temp_max);
            }
        }

        // Se tempMaxPrevista ainda for muito negativo ou igual a mínima, ajustar
        if (tempMaxPrevista === Number.MIN_SAFE_INTEGER || tempMaxPrevista === tempMin) {
            tempMaxPrevista = (parseFloat(tempMin) + 5).toFixed(1); // Definir um valor padrão maior que a mínima
        }

        // Exibir previsão completa no resultado
        const tempMaxPrevistaC = tempMaxPrevista.toFixed(1); // Converte para uma casa decimal
        const weatherText = `${tipo === 'origem' ? 'Condições Atuais' : 'Condições na Chegada'}: ${weatherEmoji} ${weatherDescription}, mínima de ${tempMin}°C e máxima de ${tempMaxPrevistaC}°C. ${proximaChuva}`;
        document.getElementById(`weather${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`).innerText = weatherText;
    } catch (error) {
        console.error('Erro ao obter previsão do tempo:', error);
    }
}

function openPopup() {
    document.getElementById('popupForm').style.display = 'block';
}

function closePopup() {
    document.getElementById('popupForm').style.display = 'none';
}

function gerarImagem() {
    const descricao = document.getElementById('descricao').value;
    const peso = document.getElementById('peso').value;
    const incluirClima = document.getElementById('incluirClima').checked;

    const cidadeOrigem = document.getElementById('cidadeOrigem').value.trim();
    const cidadeDestino = document.getElementById('cidadeDestino').value.trim();
    const distancia = document.getElementById('distancia').innerText.trim().split(': ')[1]; // Apenas o valor
    const valorFrete = document.getElementById('freteIdeal').innerText.trim().split(': ')[1]; // Apenas o valor

    let climaOrigem = '';
    let climaDestino = '';

    if (incluirClima) {
        climaOrigem = document.getElementById('weatherOrigem').innerText.trim();
        climaDestino = document.getElementById('weatherDestino').innerText.trim();
    }

    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
    const horaFormatada = dataAtual.toLocaleTimeString('pt-BR');

    const resultadoHTML = `
    <div style="text-align: center; background: white; width: 400px; height: 450px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 0px;">
        ${!incluirClima ? `<h1 style="color: #123354; margin-bottom: 10;">MixFretes</h1>` : ''}
        ${incluirClima ? `<p style="margin: 15px 0;"><strong>Clima Origem:</strong> ${climaOrigem}</p><p style="margin: 10px 0;"><strong>Clima Destino:</strong> ${climaDestino}</p>` : ''}
        <p style="margin: 12px 0;"><strong>Rota:</strong> ${cidadeOrigem} X ${cidadeDestino}</p>
        <p style="margin: 12px 0;"><strong>Distância:</strong> ${distancia}</p>
        <p style="margin: 12px 0;"><strong>Descrição:</strong> ${descricao}</p>
        <p style="margin: 12px 0;"><strong>Peso:</strong> ${peso} kg</p>
        <p style="margin: 12px 0;"><strong>Valor da Cotação:</strong> ${valorFrete}</p>
        <p style="margin: 27px 0 10px; font-size: 12px; color: #555;">Esta cotação é apenas a simulação do frete para as localidades acima mencionadas, e podem sofrer reajustes ou alterações sem aviso prévio.</p>
        <p style="margin-top: 10px; font-size: 12px; color: #555;">Gerado por: MixFretes, ${dataFormatada} às ${horaFormatada}</p>
    </div>
`;

    const resultadoDiv = document.createElement('div');
    resultadoDiv.innerHTML = resultadoHTML;
    document.body.appendChild(resultadoDiv);

    html2canvas(resultadoDiv, {
        backgroundColor: '#FFFFFF',
        scale: 2, // Scale for better resolution
        onrendered: function(canvas) {
            const imgData = canvas.toDataURL("image/png");
            const link = document.createElement('a');
            link.href = imgData;
            link.download = `${cidadeOrigem} x ${cidadeDestino}.png`; // Nome do arquivo ajustado
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            document.body.removeChild(resultadoDiv);
        }
    });

    closePopup();
}

function gerarCotacao() {
    calcularFrete();
    openPopup();
}

