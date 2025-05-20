// Variáveis para manutenção do código:
const openRouteServiceKey = '5b3ce3597851110001cf6248a7350e10fe0047d5b435df18da0ca0ab';
const openWeatherMapKey = '882a7c86ee232f1f5a53433800f48151';

const velocidadeMedia = 37; // Km/h
const milimetroschuva = 1;  // Considerar apenas chuvas com mais de 1mm
const seguroImprevistos = 200; // R$
const manutencaoKm = 0.46; //custo manutencao por km corrigido, antes era 0.32
const custoPneusKm = 0.63; //custo pneus por km, antes 0,58 mas corrigido pra margem de segurança

document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    
    // Atualizar visibilidade do campo de peso
    document.getElementById('cargaGranel').addEventListener('change', function() {
        document.getElementById('pesoContainer').style.display = this.checked ? 'block' : 'none';
        validarCheckboxes({ target: this });
        saveToLocalStorage();
    });
    
    document.getElementById('freteForm').addEventListener('input', saveToLocalStorage);
    document.getElementById('adicionarVolta').addEventListener('change', validarCheckboxes);
    document.getElementById('cargaGranel').addEventListener('change', validarCheckboxes);
    document.getElementById('themeToggle').addEventListener('click', toggleDarkMode);
    
    // Inicializar visibilidade do peso
    document.getElementById('pesoContainer').style.display = 
        document.getElementById('cargaGranel').checked ? 'block' : 'none';
    
    checkDarkModePreference();
});

// Função para alternar o tema escuro
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const icon = document.getElementById('themeToggle').querySelector('i');
    if (document.body.classList.contains('dark-mode')) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        localStorage.setItem('darkMode', 'enabled');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        localStorage.setItem('darkMode', 'disabled');
    }
}

// Verifique o tema ao carregar
function checkDarkModePreference() {
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
        const icon = document.getElementById('themeToggle').querySelector('i');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
}

function toggleInstructions() {
    const instructionsContent = document.getElementById('instructions-content');
    const instructionsIcon = document.getElementById('instructions-icon');
    
    // Alternar estado do acordeão
    const isOpen = instructionsContent.classList.toggle('open');
    
    // Atualizar ícone
    if (isOpen) {
        instructionsIcon.classList.remove('fa-chevron-down');
        instructionsIcon.classList.add('fa-chevron-up');
    } else {
        instructionsIcon.classList.remove('fa-chevron-up');
        instructionsIcon.classList.add('fa-chevron-down');
    }
    
    // Acessibilidade
    instructionsContent.setAttribute('aria-expanded', isOpen);
}

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

function validarCheckboxes(event) {
    const adicionarVolta = document.getElementById('adicionarVolta');
    const cargaGranel = document.getElementById('cargaGranel');
    
    // Se o evento veio de uma mudança no checkbox
    if (event && event.target) {
        const target = event.target;
        
        // Se o checkbox que foi clicado está sendo marcado
        if (target.checked) {
            // Desmarca o outro checkbox
            if (target.id === 'adicionarVolta') {
                cargaGranel.checked = false;
            } else {
                adicionarVolta.checked = false;
            }
        }
    }
    
    limparMensagensErro();
}

async function calcularFrete() {
    limparMensagensErro();

    const cidadeOrigem = document.getElementById('cidadeOrigem').value.trim();
    const cidadeDestino = document.getElementById('cidadeDestino').value.trim();
    const mediaConsumo = parseFloat(document.getElementById('mediaConsumo').value);
    const custoDiesel = parseFloat(document.getElementById('custoDiesel').value);
    const valorFrete = parseFloat(document.getElementById('valorFrete').value);
    const adicionarVolta = document.getElementById('adicionarVolta').checked;
    const cargaGranel = document.getElementById('cargaGranel').checked;
    const pesoToneladas = parseFloat(document.getElementById('pesoToneladas').value) || 0;

    if (!cidadeOrigem || !cidadeDestino || isNaN(mediaConsumo) || isNaN(custoDiesel) || isNaN(valorFrete) || (cargaGranel && isNaN(pesoToneladas))) {
        exibirMensagemErro('Por favor, preencha todos os campos corretamente.');
        return;
    }

    try {
        document.getElementById('resultado').style.display = 'none';
        
        const [origemCoords, destinoCoords] = await Promise.all([
            geocodificarCidade(cidadeOrigem),
            geocodificarCidade(cidadeDestino)
        ]);

        if (!origemCoords || !destinoCoords) {
            exibirMensagemErro('Cidade de origem ou destino não encontrada.');
            return;
        }

        const distanciaKm = await calcularDistanciaRodoviaria(origemCoords, destinoCoords);
        if (distanciaKm !== null) {
            exibirCabecalhoResultado(cidadeOrigem, cidadeDestino);
            calcularCustos(distanciaKm, mediaConsumo, custoDiesel, valorFrete, seguroImprevistos, adicionarVolta, cargaGranel, pesoToneladas);
            await Promise.all([
                exibirPrevisaoCompleta(cidadeOrigem, 'origem'),
                exibirPrevisaoCompleta(cidadeDestino, 'destino')
            ]);

            let tempoViagemHoras = Math.floor(distanciaKm / velocidadeMedia);
            let tempoViagemMinutos = Math.round((distanciaKm / velocidadeMedia - tempoViagemHoras) * 60);

            if (adicionarVolta) {
                tempoViagemHoras *= 2;
                tempoViagemMinutos *= 2;

                if (tempoViagemMinutos >= 60) {
                    tempoViagemHoras += Math.floor(tempoViagemMinutos / 60);
                    tempoViagemMinutos = tempoViagemMinutos % 60;
                }
            }

            const tempoViagemText = `${tempoViagemHoras}h ${tempoViagemMinutos}min`;
            document.getElementById('tempoViagem').innerText = tempoViagemText;
            document.getElementById('resultado').style.display = 'block';

        } else {
            exibirMensagemErro('Erro ao calcular a distância.');
        }
    } catch (error) {
        console.error('Erro ao calcular frete:', error);
        exibirMensagemErro('Erro ao calcular frete. Por favor, tente novamente.');
    }
}

function exibirCabecalhoResultado(origem, destino) {
    const cabecalho = `${origem.toUpperCase()} ⇄ ${destino.toUpperCase()}`;
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
    try {
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
    } catch (error) {
        console.error('Erro ao geocodificar cidade:', error);
        return null;
    }
}

async function calcularDistanciaRodoviaria(origemCoords, destinoCoords) {
    const urlRoute = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${openRouteServiceKey}`;
    const body = JSON.stringify({
        coordinates: [origemCoords, destinoCoords]
    });

    try {
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
            return data.routes[0].summary.distance / 1000; // Convertendo para km
        } else {
            console.error('Rota não encontrada.');
            return null;
        }
    } catch (error) {
        console.error('Erro ao calcular distância:', error);
        return null;
    }
}

function calcularCustos(distanciaKm, mediaConsumo, custoDiesel, valorFrete, seguroImprevistos, adicionarVolta, cargaGranel, pesoToneladas) {
    if (adicionarVolta) {
        distanciaKm *= 2;
    }

    const custoComDiesel = (distanciaKm / mediaConsumo) * custoDiesel;
    const custoComManutencao = distanciaKm * manutencaoKm;
    const custoComPneus = distanciaKm * custoPneusKm;
    const valorTotalDespesas = custoComDiesel + custoComManutencao + custoComPneus + seguroImprevistos;
    const lpkmIdeal = distanciaKm <= 400 ? 2.5 : 2.0;
    const freteIdeal = valorTotalDespesas + (lpkmIdeal * distanciaKm);
    let lucroPrejuizo;
    let lucroPorKm;
    let freteTotal;

    if (cargaGranel) {
        freteTotal = valorFrete * pesoToneladas;
        lucroPrejuizo = freteTotal - valorTotalDespesas;
        lucroPorKm = lucroPrejuizo / distanciaKm;
    } else {
        freteTotal = valorFrete;
        lucroPrejuizo = valorFrete - valorTotalDespesas;
        lucroPorKm = lucroPrejuizo / distanciaKm;
    }

    // Formatando valores para exibição
    document.getElementById('precoFrete').innerHTML = `<strong>Preço do Frete:</strong> R$ ${freteTotal.toFixed(2).replace('.', ',')}`;
    document.getElementById('distancia').innerHTML = `<strong>Distância:</strong> ${distanciaKm.toFixed(2).replace('.', ',')} km`;
    document.getElementById('custoDieselResultado').innerHTML = `<strong>Custo com Diesel:</strong> R$ ${custoComDiesel.toFixed(2).replace('.', ',')}`;
    document.getElementById('custoManutencao').innerHTML = `<strong>Custo com Manutenção:</strong> R$ ${custoComManutencao.toFixed(2).replace('.', ',')}`;
    document.getElementById('custoPneus').innerHTML = `<strong>Custo com Pneus:</strong> R$ ${custoComPneus.toFixed(2).replace('.', ',')}`;
    document.getElementById('seguroImprevistos').innerHTML = `<strong>Seguro de Imprevistos:</strong> R$ ${seguroImprevistos.toFixed(2).replace('.', ',')}`;
    document.getElementById('valorTotalDespesas').innerHTML = `<strong>Total de Despesas:</strong> R$ ${valorTotalDespesas.toFixed(2).replace('.', ',')}`;
    document.getElementById('lucroPorKm').innerHTML = `<strong>Lucro por Km:</strong> R$ ${lucroPorKm.toFixed(2).replace('.', ',')}`;
    document.getElementById('freteIdeal').innerHTML = `<strong>Frete Ideal:</strong> R$ ${freteIdeal.toFixed(2).replace('.', ',')}`;

    const lucroPrejuizoElement = document.getElementById('lucroPrejuizo');
    if (lucroPrejuizo >= 0) {
        lucroPrejuizoElement.innerHTML = `<strong>Lucro:</strong> R$ ${lucroPrejuizo.toFixed(2).replace('.', ',')}`;
        lucroPrejuizoElement.className = 'result-item positivo';
        document.getElementById('lucroPrejuizoCard').className = 'result-card full-width positivo';
    } else {
        lucroPrejuizoElement.innerHTML = `<strong>Prejuízo:</strong> R$ ${Math.abs(lucroPrejuizo).toFixed(2).replace('.', ',')}`;
        lucroPrejuizoElement.className = 'result-item negativo';
        document.getElementById('lucroPrejuizoCard').className = 'result-card full-width negativo';
    }
}

function copiarResultado() {
    const cityNames = document.getElementById('cityNames').innerText.trim();
    const adicionarVolta = document.getElementById('adicionarVolta').checked ? 'Sim' : 'Não';
    const cargaGranel = document.getElementById('cargaGranel').checked ? 'Sim' : 'Não';
    const distancia = document.getElementById('distancia').innerText.replace('<strong>', '').replace('</strong>', '').trim();
    const custoDieselResultado = document.getElementById('custoDieselResultado').innerText.replace('<strong>', '').replace('</strong>', '').trim();
    const custoManutencao = document.getElementById('custoManutencao').innerText.replace('<strong>', '').replace('</strong>', '').trim();
    const custoPneus = document.getElementById('custoPneus').innerText.replace('<strong>', '').replace('</strong>', '').trim();
    const seguroImprevistos = document.getElementById('seguroImprevistos').innerText.replace('<strong>', '').replace('</strong>', '').trim();
    const valorTotalDespesas = document.getElementById('valorTotalDespesas').innerText.replace('<strong>', '').replace('</strong>', '').trim();
    const lucroPorKm = document.getElementById('lucroPorKm').innerText.replace('<strong>', '').replace('</strong>', '').trim();
    const freteIdeal = document.getElementById('freteIdeal').innerText.replace('<strong>', '').replace('</strong>', '').trim();
    const lucroPrejuizo = document.getElementById('lucroPrejuizo').innerText.replace('<strong>', '').replace('</strong>', '').trim();
    const weatherOrigem = document.getElementById('weatherOrigem').innerText.trim();
    const weatherDestino = document.getElementById('weatherDestino').innerText.trim();
    const tempoViagem = document.getElementById('tempoViagem').innerText.trim();
    const freteTotal = document.getElementById('precoFrete').innerText.replace('<strong>', '').replace('</strong>', '').trim().split(': ')[1];
    const pesoToneladas = document.getElementById('pesoToneladas').value ? document.getElementById('pesoToneladas').value.trim() : null;

    const resultadoText = `
${cityNames}
${'-'.repeat(cityNames.length)}

• Container ida+volta: ${adicionarVolta}
• Granel ou por toneladas: ${cargaGranel}

${weatherOrigem}
${weatherDestino}

${'-'.repeat(30)}

• ${distancia}
• ${tempoViagem}

${'-'.repeat(30)}

• ${custoDieselResultado}
• ${custoManutencao}
• ${custoPneus}
• ${seguroImprevistos}
• ${valorTotalDespesas}
• ${lucroPorKm}
• ${freteIdeal}

${'-'.repeat(30)}

• ${lucroPrejuizo}
${pesoToneladas ? `• Toneladas: ${pesoToneladas}` : ''}
• Valor do frete: ${freteTotal}

${'-'.repeat(30)}
Gerado por MixFretes - ${new Date().toLocaleString('pt-BR')}
    `;

    navigator.clipboard.writeText(resultadoText.trim()).then(() => {
        const copyBtn = document.querySelector('.copy-button');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
        copyBtn.style.backgroundColor = '#10b981';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.backgroundColor = '';
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar texto: ', err);
        alert('Não foi possível copiar o resultado. Por favor, tente novamente.');
    });
}

async function exibirPrevisaoCompleta(cidade, tipo) {
    const urlWeather = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cidade)}&appid=${openWeatherMapKey}&units=metric&lang=pt_br`;
    const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(cidade)}&appid=${openWeatherMapKey}&units=metric&lang=pt_br`;

    try {
        const responseWeather = await fetch(urlWeather);
        if (!responseWeather.ok) {
            throw new Error('Erro na requisição da previsão do tempo: ' + responseWeather.statusText);
        }

        const dataWeather = await responseWeather.json();
        const weather = dataWeather.weather[0].main.toLowerCase();
        const tempAtual = dataWeather.main.temp.toFixed(1);
        const tempMin = dataWeather.main.temp_min.toFixed(1);

        let tempMaxPrevista = Number.MIN_SAFE_INTEGER;

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
                weatherDescription = 'Chuva com trovão';
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
            default:
                weatherEmoji = '☁️';
                weatherDescription = 'Nublado';
                break;
        }

        const responseForecast = await fetch(urlForecast);
        if (!responseForecast.ok) {
            throw new Error('Erro na requisição da previsão de chuva: ' + responseForecast.statusText);
        }

        const dataForecast = await responseForecast.json();
        let proximaChuva = 'sem previsão de chuva significativa';

        for (let i = 0; i < dataForecast.list.length; i++) {
            const chuva = dataForecast.list[i].rain ? dataForecast.list[i].rain['3h'] : 0;
            if (chuva > milimetroschuva) {
                const dataHoraChuva = new Date(dataForecast.list[i].dt_txt);
                const options = { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                };
                const dataFormatada = new Intl.DateTimeFormat('pt-BR', options).format(dataHoraChuva);
                proximaChuva = `Próxima chuva: ${dataFormatada} (${chuva.toFixed(1)}mm)`;
                break;
            }

            if (dataForecast.list[i].main.temp_max !== undefined) {
                tempMaxPrevista = Math.max(tempMaxPrevista, dataForecast.list[i].main.temp_max);
            }
        }

        if (tempMaxPrevista === Number.MIN_SAFE_INTEGER || tempMaxPrevista === tempMin) {
            tempMaxPrevista = (parseFloat(tempMin) + 5).toFixed(1);
        }

        const tempMaxPrevistaC = tempMaxPrevista.toFixed(1);
        const weatherText = `${weatherEmoji} <strong>${tipo === 'origem' ? 'Origem' : 'Destino'}:</strong> ${weatherDescription}, ${tempAtual}°C (min ${tempMin}°C, max ${tempMaxPrevistaC}°C) | ${proximaChuva}`;
        document.getElementById(`weather${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`).innerHTML = weatherText;
    } catch (error) {
        console.error('Erro ao obter previsão do tempo:', error);
        document.getElementById(`weather${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`).innerText = 
            `Não foi possível obter dados climáticos para ${tipo === 'origem' ? 'a origem' : 'o destino'}`;
    }
}

function openPopup() {
    document.getElementById('popupForm').style.display = 'flex';
}

function closePopup() {
    document.getElementById('popupForm').style.display = 'none';
}

async function gerarImagem() {
    try {
        // Obter dados do cliente
        const cliente = document.getElementById('cliente').value || 'Não informado';
        const contatoCliente = document.getElementById('contatoCliente').value || 'Não informado';
        const enderecoCliente = document.getElementById('enderecoCliente').value || 'Não informado';
        const dadosAdicionaisCliente = document.getElementById('dadosAdicionaisCliente').value || 'Nenhuma observação';
        
        // Obter dados do frete
        const descricaoCarga = document.getElementById('descricaoCarga').value || 'Não especificado';
        const enderecoEntrega = document.getElementById('enderecoEntrega').value || 'Não especificado';
        const informacoesComplementares = document.getElementById('informacoesComplementares').value || 'Nenhuma informação complementar';
        const incluirClima = document.getElementById('incluirClima').checked;
        const incluirTempo = document.getElementById('incluirTempoEntrega').checked;
        
        // Verificar campos obrigatórios
        if(!descricaoCarga) {
            alert('Por favor, preencha a descrição da carga');
            return;
        }

        // Obter dados do frete calculado
        const cidadeOrigem = document.getElementById('cidadeOrigem').value.trim();
        const cidadeDestino = document.getElementById('cidadeDestino').value.trim();
        const distancia = document.getElementById('distancia').innerText.replace(/<[^>]*>/g, '').trim();
        const valorFrete = document.getElementById('freteIdeal').innerText.replace(/<[^>]*>/g, '').trim();
        const tempoViagem = document.getElementById('tempoViagem').innerText;

        // Criar container temporário
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '800px';
        tempDiv.style.padding = '30px';
        tempDiv.style.backgroundColor = '#ffffff';
        tempDiv.style.boxShadow = '0 0 20px rgba(0,0,0,0.1)';
        tempDiv.style.borderRadius = '10px';
        tempDiv.style.fontFamily = "'Poppins', sans-serif";

        // Data e hora formatadas
        const dataEmissao = new Date();
        const dataFormatada = dataEmissao.toLocaleDateString('pt-BR');
        const horaFormatada = dataEmissao.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

        // Construir HTML da cotação
        let htmlContent = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="display: inline-flex; align-items: center; margin-bottom: 10px;">
                    <i class="fas fa-truck-moving" style="font-size: 2.5rem; color: #2563eb; margin-right: 15px;"></i>
                    <h1 style="margin: 0; color: #2563eb; font-size: 2.2rem;">Mix<span style="font-weight: 300;">Fretes</span></h1>
                </div>
                <div style="height: 2px; background: #2563eb; width: 100%; margin-bottom: 15px;"></div>
                <div style="text-align: center; color: #64748b; font-size: 0.9rem; margin-bottom: 10px;">
                    <p style="margin: 0;">Emitido em: ${dataFormatada} às ${horaFormatada}</p>
                </div>
            </div>

            <!-- Seção Cliente -->
            <div style="margin-bottom: 25px;">
                <h2 style="color: #2563eb; margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">
                    <i class="fas fa-user-tie"></i> Dados do Cliente
                </h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                    <div>
                        <p><strong>Cliente:</strong> ${cliente}</p>
                        <p><strong>Endereço:</strong><br>${enderecoCliente.replace(/\n/g, '<br>')}</p>
                    </div>
                    <div>
                        <p><strong>Contato:</strong> ${contatoCliente}</p>
                        <p><strong>Observações:</strong><br>${dadosAdicionaisCliente.replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            </div>

            <!-- Seção Frete -->
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h2 style="color: #2563eb; margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">
                    <i class="fas fa-truck"></i> Detalhes do Frete
                </h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                    <div>
                        <p><strong>Rota:</strong><br>${cidadeOrigem} ⇄ ${cidadeDestino}</p>
                        <p><strong>Distância:</strong><br>${distancia}</p>
                        ${incluirTempo ? `<p><strong>Tempo estimado:</strong><br>${tempoViagem}</p>` : ''}
                    </div>
                    <div>
                        <p><strong>Descrição:</strong><br>${descricaoCarga}</p>
                        <p><strong>Endereço de entrega:</strong><br>${enderecoEntrega.replace(/\n/g, '<br>')}</p>
                        <p><strong>Informações complementares:</strong><br>${informacoesComplementares.replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            </div>
        `;

        // Adicionar seção de clima se marcado
        if(incluirClima) {
            const climaOrigem = document.getElementById('weatherOrigem').innerText.replace(/<[^>]*>/g, '').trim();
            const climaDestino = document.getElementById('weatherDestino').innerText.replace(/<[^>]*>/g, '').trim();
            
            htmlContent += `
                <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #10b981;">
                    <h3 style="margin-top: 0; color: #065f46;">Condições Climáticas</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div><strong>Origem (${cidadeOrigem}):</strong><br>${climaOrigem}</div>
                        <div><strong>Destino (${cidadeDestino}):</strong><br>${climaDestino}</div>
                    </div>
                </div>
            `;
        }

        const valorFreteFormatado = document.getElementById('freteIdeal').innerText
            .replace(/<[^>]*>/g, '') // Remove tags HTML
            .replace('Frete Ideal:', '') // Remove o texto "Frete Ideal:"
            .trim();

        // Adicionar valor do frete e rodapé (parte modificada)
        htmlContent += `
        <div style="background: #eff6ff; padding: 25px; border-radius: 8px; text-align: center; margin-bottom: 8px; border: 2px solid #2563eb;">
            <h3 style="margin-top: 0; color: #2563eb; font-size: 1.6rem;">Valor Final de Cotação:</h3>
            <p style="font-size: 2rem; font-weight: bold; color: #1e293b; margin: 10px 0;">${valorFreteFormatado}</p>
        </div>
    
        <div style="text-align: center; color: #64748b; font-size: 0.6rem; margin-top: 2px;">
            <p style="margin: 4px 0 8px;">Esta cotação é válida por 7 dias a partir da data de emissão. Inclui custos operacionais, seguros e impostos estimados. Valor sujeito a reajuste em caso de alterações na rota ou prazos. Frete calculado com base nas informações fornecidas e em condições padrão de mercado.</p>
            <p style="font-size: 0.9rem; margin-top: 10px;">MixFretes - Soluções em Transporte</p>
            <p style="font-size: 0.8rem; margin-top: 5px;">www.mixfretes.com.br | contato@mixfretes.com.br</p>
            <!-- <p style="font-size: 0.8rem;">(11) 99999-9999</p> -->
        </div>
    `;
    

        tempDiv.innerHTML = htmlContent;
        document.body.appendChild(tempDiv);

        // Carregar Font Awesome dinamicamente se necessário
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const faLink = document.createElement('link');
            faLink.rel = 'stylesheet';
            faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            document.head.appendChild(faLink);
        }

        // Aguardar o carregamento dos recursos
        await new Promise(resolve => setTimeout(resolve, 500));

        // Gerar a imagem
        const canvas = await html2canvas(tempDiv, {
            scale: 2,
            logging: true,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });

        // Criar link de download
        const link = document.createElement('a');
        link.download = `Cotacao_MixFretes_${cidadeOrigem}_${cidadeDestino}_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        // Remover div temporária
        document.body.removeChild(tempDiv);

        // Feedback visual
        const generateBtn = document.querySelector('.generate-btn');
        if (generateBtn) {
            generateBtn.innerHTML = '<i class="fas fa-check"></i> Cotação Gerada!';
            generateBtn.style.backgroundColor = '#10b981';
            setTimeout(() => {
                generateBtn.innerHTML = '<i class="fas fa-file-image"></i> Gerar Imagem';
                generateBtn.style.backgroundColor = '';
            }, 2000);
        }

    } catch (error) {
        console.error('Erro ao gerar imagem:', error);
        alert('Ocorreu um erro ao gerar a imagem. Verifique o console para detalhes.');
    } finally {
        closePopup();
    }
}

function gerarCotacao() {
    if (document.getElementById('resultado').style.display === 'none') {
        exibirMensagemErro('Calcule o frete antes de gerar a cotação.');
        return;
    }
    openPopup();
}