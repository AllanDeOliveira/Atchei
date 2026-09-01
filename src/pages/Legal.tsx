import { useNavigate } from 'react-router-dom';
import { goBack } from '../lib/utils';
import { ArrowLeft } from 'lucide-react';

// Documentos legais estáticos.
const ATUALIZACAO = '13 de agosto de 2026';

const LegalLayout = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <button
          onClick={() => goBack(navigate)}
          className="p-2.5 rounded-xl bg-surface border border-glassBorder text-accent hover:border-accent/40 hover:bg-surfaceHover transition-all duration-300 neo-click mb-6"
          title="Voltar"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-semibold text-3xl text-textLight mb-1">{titulo}</h1>
        <p className="text-xs text-textMuted mb-8">Última atualização: {ATUALIZACAO}</p>
        <div className="space-y-6 text-sm text-textLight/85 leading-relaxed text-left [&_h2]:font-display [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:text-textLight [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_p]:mb-3">
          {children}
        </div>
      </div>
    </div>
  );
};

export const Privacidade = () => (
  <LegalLayout titulo="Política de Privacidade">
    <p>
      Esta Política de Privacidade descreve como o <strong>Atchei</strong>, operado por{' '}
      <strong>Allan de Oliveira Francisco</strong>, inscrito no CPF sob o nº{' '}
      <strong>705.173.412-12</strong>, com sede em <strong>Cáceres/MT</strong> ("nós", "Plataforma"),
      trata dados pessoais, na qualidade de <strong>controlador</strong>, em conformidade com a
      Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD).
    </p>

    <h2>1. Quais dados coletamos</h2>
    <ul>
      <li><strong>Conta:</strong> nome, data de nascimento (para verificação da idade mínima de 18 anos), e-mail, senha (armazenada de forma criptografada pelo provedor de autenticação), tipo de perfil (pessoal ou profissional) e, se você adicionar, foto e descrição.</li>
      <li><strong>Compra de ingresso via Pix:</strong> nome, CPF, e-mail e telefone celular, necessários para emissão da cobrança, identificação do ingresso e contato sobre a compra.</li>
      <li><strong>Confirmação de presença em evento gratuito:</strong> nome, e-mail e telefone celular.</li>
      <li><strong>Organizadores que recebem pagamentos:</strong> CPF/CNPJ, celular e e-mail, exigidos pela instituição de pagamento para cadastro do recebedor.</li>
      <li><strong>Contatos de venda (promoters):</strong> nome e número de WhatsApp, informados pelo organizador do evento.</li>
      <li><strong>Validação de ingresso (portaria):</strong> registro de check-in (ingresso, data/hora e conta que validou). A câmera é usada apenas para leitura do QR Code — nenhuma imagem é gravada.</li>
      <li><strong>Notificações:</strong> token de push do dispositivo, se você ativar notificações.</li>
      <li><strong>Uso e segurança:</strong> dados de navegação e métricas de uso (Google Analytics), identificadores locais de sessão e verificações antifraude/antibot (reCAPTCHA / Firebase App Check), incluindo endereço IP.</li>
      <li><strong>Localização:</strong> <strong>não coletamos</strong> a localização do seu dispositivo. Os mapas exibidos mostram apenas o endereço informado pelo organizador do evento.</li>
    </ul>

    <h2>1.1 Cookies e armazenamento local</h2>
    <p>Utilizamos as seguintes categorias de armazenamento no seu navegador:</p>
    <ul>
      <li><strong>Estritamente necessários:</strong> dados de sessão de login e tokens de segurança (autenticação e App Check), indispensáveis ao funcionamento da Plataforma — dispensam consentimento.</li>
      <li><strong>Analíticos:</strong> métricas do Google Analytics (GA4) para entender o desempenho e aprimorar a Plataforma. Se você optar por aceitar apenas essenciais, o sistema opera via <strong>Google Consent Mode v2</strong> com medição anônima e sem gravação de cookies no seu navegador. Caso você autorize expressamente, cookies analíticos são ativados para medição completa — a escolha não afeta nem limita o uso da Plataforma.</li>
    </ul>
    <p>
      Sua escolha fica salva no navegador e pode ser alterada ou revogada a qualquer momento em{' '}
      <strong>Preferências de cookies</strong>, no rodapé do site.
    </p>

    <h2>2. Para que usamos e com quais bases legais</h2>
    <ul>
      <li><strong>Prestar o serviço</strong> (criar conta, publicar eventos, emitir e validar ingressos, confirmar presença) — execução de contrato (art. 7º, V, LGPD).</li>
      <li><strong>Processar pagamentos e emitir comprovantes</strong> — execução de contrato e cumprimento de obrigação legal/regulatória (art. 7º, II e V).</li>
      <li><strong>Segurança, prevenção a fraudes e abuso</strong> (rate limiting, App Check, logs) — legítimo interesse (art. 7º, IX) e garantia da prevenção à fraude.</li>
      <li><strong>Notificações push</strong> — consentimento (art. 7º, I), revogável a qualquer momento nas configurações do dispositivo.</li>
      <li><strong>Métricas e melhoria da Plataforma</strong> — legítimo interesse, com dados agregados sempre que possível.</li>
    </ul>

    <h2>3. Com quem compartilhamos</h2>
    <p>Não vendemos dados pessoais. Compartilhamos apenas com:</p>
    <ul>
      <li><strong>Asaas Gestão Financeira S.A.</strong> — processamento de pagamentos Pix e repasse aos organizadores (nome, CPF, e-mail do comprador; dados cadastrais do recebedor).</li>
      <li><strong>Google LLC (Firebase)</strong> — infraestrutura de autenticação, banco de dados, hospedagem, notificações e análise de uso.</li>
      <li><strong>Organizador do evento</strong> — recebe a lista de participantes do próprio evento (nome, CPF quando aplicável, e-mail e status do ingresso) para controle de entrada. O organizador é responsável pelo tratamento que fizer desses dados fora da Plataforma, na condição de controlador próprio.</li>
      <li><strong>Autoridades públicas</strong> — quando houver obrigação legal ou ordem judicial.</li>
    </ul>

    <h2>4. Transferência internacional</h2>
    <p>
      Os serviços do Google podem armazenar dados em servidores fora do Brasil. Essas
      transferências são amparadas por cláusulas contratuais e mecanismos de conformidade do
      provedor, nos termos do art. 33 da LGPD.
    </p>

    <h2>5. Por quanto tempo guardamos</h2>
    <ul>
      <li><strong>Dados de conta:</strong> enquanto a conta existir; após exclusão, apenas pelo prazo necessário ao cumprimento de obrigações legais.</li>
      <li><strong>Registros de pagamento:</strong> 5 anos, para fins fiscais e de defesa em processos (arts. 15 e 16 da LGPD).</li>
      <li><strong>Registros de acesso à aplicação:</strong> 6 meses, conforme art. 15 do Marco Civil da Internet (Lei nº 12.965/2014).</li>
      <li><strong>Inscrições e check-ins:</strong> até a prestação de contas do evento ao organizador e pelos prazos legais aplicáveis.</li>
    </ul>

    <h2>6. Seus direitos (art. 18 da LGPD)</h2>
    <p>
      Você pode solicitar, a qualquer momento: confirmação da existência de tratamento; acesso
      aos seus dados; correção de dados incompletos ou desatualizados; anonimização, bloqueio ou
      eliminação de dados desnecessários; portabilidade; informação sobre compartilhamentos;
      revogação de consentimento; e eliminação dos dados tratados com base em consentimento.
    </p>
    <p>
      Para exercer seus direitos, contate nosso Encarregado de Proteção de Dados (DPO):{' '}
      <strong>Allan de Oliveira Francisco</strong> — <strong>contato.atchei@gmail.com</strong>. A confirmação
      de existência de tratamento e o acesso aos dados serão respondidos em formato simplificado
      imediatamente, ou por declaração completa em até <strong>15 (quinze) dias</strong> contados
      do requerimento (art. 19, II, da LGPD); as demais solicitações, em prazo compatível.
      Você também pode peticionar à Autoridade Nacional de Proteção de Dados (ANPD).
    </p>

    <h2>6.1 Exclusão de conta e dados</h2>
    <p>
      Para excluir definitivamente sua conta, envie a solicitação pelo e-mail do Encarregado
      indicado acima, a partir do e-mail cadastrado na conta. Confirmada a identidade,
      eliminaremos ou anonimizaremos seus dados pessoais, ressalvados os de guarda obrigatória
      (registros de pagamento por 5 anos e registros de acesso por 6 meses), que ficam bloqueados
      para qualquer outro uso até o fim do prazo legal.
    </p>

    <h2>7. Segurança</h2>
    <p>
      Adotamos medidas técnicas e administrativas aptas a proteger os dados (art. 46 da LGPD):
      criptografia em trânsito, regras de acesso por perfil no banco de dados, autenticação
      gerenciada, verificação de integridade do aplicativo (App Check), limitação de taxa em
      operações sensíveis e restrição de acesso interno. Nenhum sistema é infalível; em caso de
      incidente de segurança relevante, comunicaremos os titulares afetados e a ANPD conforme o
      art. 48 da LGPD.
    </p>

    <h2>8. Crianças e adolescentes</h2>
    <p>
      A Plataforma não é destinada a menores de <strong>18 (dezoito)</strong> anos, e não coletamos
      intencionalmente dados de crianças. Eventos com restrição etária são de responsabilidade do
      organizador, inclusive quanto ao controle de entrada.
    </p>

    <h2>9. Alterações</h2>
    <p>
      Esta Política pode ser atualizada. Mudanças relevantes serão comunicadas na Plataforma. A
      data da última atualização consta no topo desta página.
    </p>
  </LegalLayout>
);

export const QuemSomos = () => (
  <LegalLayout titulo="Quem somos">
    <p>
      O <strong>Atchei</strong> é a plataforma de <strong>eventos e ingressos de Cáceres-MT</strong>.
      Reunimos em um só lugar o que está acontecendo na cidade — festas, eventos universitários,
      shows, esporte e gastronomia — para você <strong>descobrir, confirmar presença e comprar
      ingressos por Pix</strong> em poucos toques, direto do celular.
    </p>

    <h2>Nossa história</h2>
    <p>
      O Atchei nasceu em Cáceres de uma percepção simples: os eventos da cidade viviam espalhados
      em stories, grupos de WhatsApp e cartazes — e quem organizava dependia de listas de papel e
      transferências manuais para vender. A ideia começou com <strong>Allan</strong>, que convidou{' '}
      <strong>Theo</strong> para o projeto; juntos, os dois desenvolveram o conceito até ele virar
      o que você usa hoje: o <strong>ponto de encontro entre quem faz e quem vive os eventos da
      região</strong> — divulgação num feed único, venda digital segura e portaria sem fila.
    </p>
    <p>
      Começamos por Cáceres, mas a visão é maior: <strong>levar o Atchei para o interior</strong>,
      cidade por cidade — porque evento bom não acontece só nas capitais.
    </p>

    <h2>O que oferecemos</h2>
    <ul>
      <li><strong>Feed de eventos da cidade:</strong> tudo o que vai acontecer, organizado por categoria e data.</li>
      <li><strong>Ingressos por Pix:</strong> pagamento instantâneo e ingresso com QR Code na hora, direto no app.</li>
      <li><strong>Confirmação de presença:</strong> em eventos gratuitos, garanta sua vaga com um toque.</li>
      <li><strong>Recuperação fácil:</strong> perdeu o ingresso? Recupere pelo e-mail ou CPF a qualquer momento.</li>
    </ul>

    <h2>Para organizadores</h2>
    <ul>
      <li><strong>Divulgação local:</strong> seu evento visto por quem realmente está na região.</li>
      <li><strong>Venda digital com repasse direto:</strong> receba as vendas na sua conta, com controle total.</li>
      <li><strong>Portaria digital:</strong> valide ingressos pelo QR Code usando só o celular — sem lista de papel, sem fila.</li>
      <li><strong>Venda por promoters:</strong> cadastre sua equipe de vendas e atenda os compradores pelo WhatsApp.</li>
    </ul>

    <h2>Nossos diferenciais</h2>
    <ul>
      <li><strong>Feito para o interior:</strong> pensado para a realidade de Cáceres e região, não adaptado dos grandes centros.</li>
      <li><strong>Simples de verdade:</strong> criar um evento leva minutos; comprar, segundos.</li>
      <li><strong>Segurança:</strong> pagamentos processados por instituição regulada, dados protegidos conforme a LGPD e ingresso validado uma única vez.</li>
    </ul>

    <p>
      Tem um evento para divulgar ou uma dúvida? Fale com a gente:{' '}
      <strong>contato.atchei@gmail.com</strong> ou{' '}
      <a href="https://instagram.com/atchei.app" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">@atchei.app</a>.
    </p>
  </LegalLayout>
);

export const Termos = () => (
  <LegalLayout titulo="Termos de Uso e Diretrizes">
    <p>
      Estes Termos regulam o uso da plataforma <strong>Atchei</strong>, operada por{' '}
      <strong>Allan de Oliveira Francisco</strong> ("Plataforma"). Ao criar uma conta,
      publicar um evento, comprar um ingresso ou confirmar presença, você concorda com estes
      Termos e com a nossa Política de Privacidade.
    </p>

    <h2>1. O que é o Atchei</h2>
    <p>
      O Atchei é uma plataforma de divulgação de eventos, venda de ingressos e controle de
      presença. Atuamos como <strong>intermediários</strong> entre organizadores e participantes:
      os eventos são criados, realizados e são de responsabilidade dos seus organizadores. Os
      pagamentos são processados pela instituição de pagamento parceira (Asaas), com repasse
      direto ao organizador.
    </p>

    <h2>2. Conta</h2>
    <ul>
      <li>Você deve fornecer informações verdadeiras e manter suas credenciais em sigilo — atividades feitas na sua conta são de sua responsabilidade.</li>
      <li>É necessário ter no mínimo <strong>18 (dezoito)</strong> anos para criar uma conta.</li>
      <li>Podemos suspender ou encerrar contas que violem estes Termos.</li>
    </ul>

    <h2>3. Organizadores</h2>
    <ul>
      <li>São responsáveis pela veracidade das informações do evento (data, local, preço, classificação etária) e pela sua realização.</li>
      <li>Para receber pagamentos, devem completar o cadastro de recebedor junto à instituição de pagamento, fornecendo os dados exigidos por ela.</li>
      <li>Ao acessar a lista de participantes, o organizador assume a condição de controlador desses dados fora da Plataforma e se obriga a tratá-los conforme a LGPD — utilizá-los exclusivamente para a gestão do próprio evento, sem revenda ou uso para fins não relacionados.</li>
      <li>O cancelamento do evento obriga o organizador a reembolsar integralmente os ingressos vendidos.</li>
    </ul>

    <h2>4. Participantes e ingressos</h2>
    <ul>
      <li>Comprar ingressos e confirmar presença exigem conta na Plataforma.</li>
      <li>O ingresso é pessoal, vinculado ao QR Code emitido, e validado uma única vez na portaria.</li>
      <li>Compras via Pix exigem nome, CPF e e-mail para emissão e recuperação do ingresso.</li>
      <li>Guarde seu QR Code; a recuperação de ingressos é feita pelos canais indicados na Plataforma.</li>
    </ul>

    <h2>5. Pagamentos, cancelamentos e reembolsos</h2>
    <ul>
      <li>Os pagamentos são processados pela Asaas; a Plataforma não armazena dados bancários do comprador.</li>
      <li><strong>Arrependimento:</strong> em compras online, o participante pode desistir em até 7 dias corridos após a compra (art. 49 do CDC), desde que a solicitação ocorra antes da realização do evento.</li>
      <li><strong>Evento cancelado ou adiado:</strong> reembolso integral, processado pelo organizador por meio da Plataforma/instituição de pagamento.</li>
      <li>Taxas de serviço, quando aplicáveis, são informadas antes da conclusão da compra.</li>
    </ul>

    <h2>6. Diretrizes de conteúdo</h2>
    <p>É proibido publicar eventos ou conteúdos que:</p>
    <ul>
      <li>Violem a lei, promovam atividades ilegais ou fraudulentas (incluindo eventos inexistentes);</li>
      <li>Contenham discurso de ódio, discriminação ou incitação à violência;</li>
      <li>Violem direitos de propriedade intelectual ou de imagem de terceiros;</li>
      <li>Tenham conteúdo adulto sem a devida classificação etária e sinalização;</li>
      <li>Divulguem dados pessoais de terceiros sem autorização.</li>
    </ul>
    <p>
      Podemos remover eventos, conteúdos ou contas que violem estas diretrizes, com ou sem aviso
      prévio, sem prejuízo das medidas legais cabíveis.
    </p>

    <h2>7. Propriedade intelectual</h2>
    <p>
      A marca, o layout e o software do Atchei pertencem à Plataforma. O conteúdo dos eventos
      (textos, imagens) pertence aos organizadores, que nos licenciam seu uso para divulgação
      dentro e fora da Plataforma.
    </p>

    <h2>8. Limitação de responsabilidade</h2>
    <p>
      A Plataforma é fornecida "no estado em que se encontra". Não garantimos disponibilidade
      ininterrupta e não respondemos pela realização, qualidade ou segurança dos eventos, que são
      de responsabilidade exclusiva dos organizadores — sem prejuízo dos direitos do consumidor
      previstos em lei.
    </p>

    <h2>9. Alterações</h2>
    <p>
      Estes Termos podem ser atualizados; mudanças relevantes serão comunicadas na Plataforma. O
      uso continuado após a atualização representa concordância com a nova versão.
    </p>

    <h2>10. Lei aplicável e foro</h2>
    <p>
      Aplica-se a legislação brasileira. Fica eleito o foro da comarca de{' '}
      <strong>Cáceres/MT</strong>, sem prejuízo do foro do domicílio do consumidor.
    </p>
  </LegalLayout>
);
