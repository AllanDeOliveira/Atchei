import type { EventItem } from './storage';

// Eventos de demonstracao de Caceres, gerados pelo botao do painel admin.
// creatorId e injetado (o admin logado); id e tickets sao definidos na criacao.
export const caceresMockEvents = (creatorId: string): Omit<EventItem, 'id' | 'tickets'>[] => [
      {
        title: "SUNSET PANTANEIRO",
        date: "2026-07-18",
        time: "17:00",
        location: "Iate Clube de Cáceres",
        address: "Av. Beira Rio, 1200 - Centro, Cáceres - MT, 78200-000",
        publicType: "Aberto" as const,
        description: "Venha curtir o melhor pôr do sol do Pantanal ao som de DJs regionais e muito pop/rock. Ambiente paradisíaco e drinks exclusivos na beira do rio.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "VIOLADA UNIVERSITÁRIA",
        date: "2026-07-24",
        time: "22:00",
        location: "Espaço Villa Maria",
        address: "R. dos Colhereiros, 450 - Jardim Paraíso, Cáceres - MT, 78200-000",
        publicType: "Universitário" as const,
        description: "A maior violada universitária da região! Muito sertanejo universitário, modão de viola e as atléticas mais animadas da cidade integradas na melhor PoC do semestre.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "CÁCERES ROCK FEST",
        date: "2026-08-01",
        time: "19:00",
        location: "Praia do Daveron",
        address: "Av. Beira Rio, s/n - Daveron, Cáceres - MT, 78200-000",
        publicType: "Aberto" as const,
        description: "Festival de Rock na beira do rio Paraguai. Bandas locais e nacionais tocando clássicos do rock nacional e internacional. Praça de alimentação e exposição de motos.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1469488865564-c2de10f69f96?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "BAILE DA VULCÂNICA",
        date: "2026-08-07",
        time: "21:00",
        location: "Quadra da FAPAN",
        address: "Av. São João, s/n - Cavalhada, Cáceres - MT, 78200-000",
        publicType: "Universitário" as const,
        description: "Festa oficial da Liga Vulkanica da UNEMAT! Muita música eletrônica, funk e pop para agitar a noite acadêmica. Integração total entre os cursos.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "PAGODE DO BARÃO",
        date: "2026-07-19",
        time: "15:00",
        location: "Praça Barão do Rio Branco",
        address: "Praça Barão do Rio Branco, s/n - Centro, Cáceres - MT, 78200-000",
        publicType: "Geral" as const,
        description: "Aquele pagodinho de domingo à tarde no coração da cidade! Roda de samba, cerveja gelada e o melhor clima pantaneiro para fechar o fim de semana com chave de ouro.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1481162854517-d9e353af153d?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "EXPOCÁCERES WARM UP",
        date: "2026-08-14",
        time: "20:00",
        location: "Parque de Exposição Dr. Lázaro de Carvalho",
        address: "Rodovia BR-070, s/n - Zona Rural, Cáceres - MT, 78200-000",
        publicType: "Geral" as const,
        description: "O esquenta oficial para a maior feira agropecuária da região. Shows de sertanejo, leilões and praça de alimentação no melhor estilo country.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1549417229-aa67d3263c09?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "HALLOWEEN ANTECIPADO",
        date: "2026-08-28",
        time: "23:00",
        location: "Clube Monte Verde",
        address: "Av. dos Estados, 300 - Jardim Monte Verde, Cáceres - MT, 78200-000",
        publicType: "Aberto" as const,
        description: "Festa a fantasia mais esperada do ano! Decoração temática assustadora, concursos de fantasias com prêmios e a pista comandada pelos melhores DJs de open format.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "STAND-UP COMEDY CÁCERES",
        date: "2026-07-30",
        time: "20:00",
        location: "Espaço Conecta",
        address: "R. Coronel José Dulce, 150 - Centro, Cáceres - MT, 78200-000",
        publicType: "Geral" as const,
        description: "Uma noite de gargalhadas garantidas com os melhores comediantes do estado de Mato Grosso. Show de stand-up inédito na cidade com opções de chopp e petiscos.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1585699324551-f6c309eed262?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "LUAU DA UNEMAT",
        date: "2026-08-08",
        time: "18:30",
        location: "Orla Beira Rio da UNEMAT",
        address: "Av. Santos Dumont, s/n - Santos Dumont, Cáceres - MT, 78200-000",
        publicType: "Universitário" as const,
        description: "Luau acústico sob a luz da lua na orla da UNEMAT. Roda de violão, fogueira controlada, comidinhas e bebidas para celebrar a volta às aulas com a galera acadêmica.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "SERTANEJO PREMIUM",
        date: "2026-08-22",
        time: "22:00",
        location: "Centro de Eventos Sicredi",
        address: "Av. Getúlio Vargas, 1800 - Cavalhada, Cáceres - MT, 78200-000",
        publicType: "Geral" as const,
        description: "O melhor da música sertaneja em um ambiente climatizado e sofisticado. Duplas consagradas no cenário mato-grossense tocando sucessos do modão ao sertanejo pop.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800"
        ]
      }
];
