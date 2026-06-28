export type EventType = 'holiday' | 'commemorative';

export interface CalendarEvent {
  date: string; // Format: MM-DD
  name: string;
  type: EventType;
}

// Function to calculate Easter Sunday for a given year
function getEaster(year: number): Date {
  const f = Math.floor,
        G = year % 19,
        C = f(year / 100),
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
        L = I - J,
        month = 3 + f((L + 40) / 44),
        day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

// Helper to get Nth Sunday of a month
function getNthSunday(year: number, month: number, nth: number): Date {
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 0) {
      count++;
      if (count === nth) return new Date(date);
    }
    date.setDate(date.getDate() + 1);
  }
  return new Date(year, month - 1, 1); // fallback
}

// Function to get all holidays and events for a given year
export function getHolidays(year: number): CalendarEvent[] {
  const events: CalendarEvent[] = [
    // Feriados Nacionais Fixos
    { date: '01-01', name: 'Confraternização Universal', type: 'holiday' },
    { date: '04-21', name: 'Tiradentes', type: 'holiday' },
    { date: '05-01', name: 'Dia do Trabalhador', type: 'holiday' },
    { date: '09-07', name: 'Independência do Brasil', type: 'holiday' },
    { date: '10-12', name: 'Nossa Senhora Aparecida', type: 'holiday' },
    { date: '11-02', name: 'Finados', type: 'holiday' },
    { date: '11-15', name: 'Proclamação da República', type: 'holiday' },
    { date: '11-20', name: 'Consciência Negra', type: 'holiday' },
    { date: '12-25', name: 'Natal', type: 'holiday' },
    
    // Feriados e Datas Comemorativas - Maceió / Alagoas
    { date: '06-24', name: 'São João', type: 'holiday' },
    { date: '06-29', name: 'São Pedro', type: 'holiday' },
    { date: '08-27', name: 'Nossa Sra. dos Prazeres (Padroeira AL)', type: 'holiday' },
    { date: '09-16', name: 'Emancipação de Alagoas', type: 'holiday' },
    { date: '12-05', name: 'Emancipação de Maceió', type: 'holiday' },
    { date: '12-08', name: 'Nossa Sra. da Conceição', type: 'holiday' },

    // Datas Comemorativas / Comerciais Gerais
    { date: '03-08', name: 'Dia Int. da Mulher', type: 'commemorative' },
    { date: '03-15', name: 'Dia do Consumidor', type: 'commemorative' },
    { date: '03-22', name: 'Dia Mundial da Água', type: 'commemorative' },
    { date: '03-31', name: 'Dia da Saúde e Nutrição', type: 'commemorative' },
    { date: '04-07', name: 'Dia Mundial da Saúde', type: 'commemorative' },
    { date: '04-19', name: 'Dia dos Povos Indígenas', type: 'commemorative' },
    { date: '04-22', name: 'Dia da Terra / Agente de Viagens', type: 'commemorative' },
    { date: '05-08', name: 'Dia Nacional do Turismo', type: 'commemorative' },
    { date: '05-10', name: 'Dia do Guia de Turismo', type: 'commemorative' },
    { date: '05-17', name: 'Dia Internacional da Reciclagem', type: 'commemorative' },
    { date: '06-05', name: 'Dia do Meio Ambiente', type: 'commemorative' },
    { date: '06-08', name: 'Dia Mundial dos Oceanos', type: 'commemorative' },
    { date: '06-12', name: 'Dia dos Namorados', type: 'commemorative' },
    { date: '06-13', name: 'Dia do Turista', type: 'commemorative' },
    { date: '07-17', name: 'Dia de Proteção às Florestas', type: 'commemorative' },
    { date: '08-05', name: 'Dia Nacional da Saúde', type: 'commemorative' },
    { date: '08-11', name: 'Dia do Estudante / Advogado', type: 'commemorative' },
    { date: '08-13', name: 'Dia do Economista', type: 'commemorative' },
    { date: '08-27', name: 'Dia do Corretor de Imóveis', type: 'commemorative' },
    { date: '09-09', name: 'Dia do Administrador', type: 'commemorative' },
    { date: '09-15', name: 'Dia do Cliente', type: 'commemorative' },
    { date: '09-21', name: 'Dia da Árvore', type: 'commemorative' },
    { date: '09-23', name: 'Dia do Técnico em Edificações', type: 'commemorative' },
    { date: '09-27', name: 'Dia Mundial do Turismo / Encanador', type: 'commemorative' },
    { date: '10-04', name: 'Dia da Natureza', type: 'commemorative' },
    { date: '10-05', name: 'Dia do Empreendedor', type: 'commemorative' },
    { date: '10-12', name: 'Dia do Mar', type: 'commemorative' },
    { date: '10-15', name: 'Dia do Professor / Consumo Consciente', type: 'commemorative' },
    { date: '10-17', name: 'Dia do Eletricista', type: 'commemorative' },
    { date: '10-18', name: 'Dia do Pintor', type: 'commemorative' },
    { date: '10-19', name: 'Dia da Inovação', type: 'commemorative' },
    { date: '10-25', name: 'Dia do Engenheiro Civil', type: 'commemorative' },
    { date: '10-26', name: 'Dia do Trab. da Construção Civil', type: 'commemorative' },
    { date: '10-28', name: 'Dia do Servidor Público', type: 'commemorative' },
    { date: '10-30', name: 'Dia do Designer de Interiores', type: 'commemorative' },
    { date: '10-31', name: 'Dia Mundial da Poupança', type: 'commemorative' },
    { date: '11-05', name: 'Dia da Conservação da Natureza', type: 'commemorative' },
    { date: '11-08', name: 'Dia do Urbanismo', type: 'commemorative' },
    { date: '11-19', name: 'Bandeira / Empreendedorismo Feminino', type: 'commemorative' },
    { date: '12-11', name: 'Dia do Engenheiro', type: 'commemorative' },
    { date: '12-13', name: 'Dia do Pedreiro / Avaliador', type: 'commemorative' },
    { date: '12-15', name: 'Dia do Arquiteto', type: 'commemorative' },
  ];

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const formatDate = (date: Date) => {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
  };

  // Feriados Móveis
  const easter = getEaster(year);
  events.push({ date: formatDate(addDays(easter, -47)), name: 'Carnaval', type: 'holiday' });
  events.push({ date: formatDate(addDays(easter, -2)), name: 'Sexta-feira Santa', type: 'holiday' });
  events.push({ date: formatDate(easter), name: 'Páscoa', type: 'commemorative' });
  events.push({ date: formatDate(addDays(easter, 60)), name: 'Corpus Christi', type: 'holiday' });

  // Datas Comemorativas Móveis
  const mothersDay = getNthSunday(year, 5, 2);
  const fathersDay = getNthSunday(year, 8, 2);
  events.push({ date: formatDate(mothersDay), name: 'Dia das Mães', type: 'commemorative' });
  events.push({ date: formatDate(fathersDay), name: 'Dia dos Pais', type: 'commemorative' });

  return events;
}
