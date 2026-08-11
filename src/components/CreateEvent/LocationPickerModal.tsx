import { useState, useEffect } from 'react';
import { X, MapPin, Loader2, Search as SearchIcon } from 'lucide-react';
import { useMap, useMapsLibrary, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Button } from '../ui/Button';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

const GOOGLE_MAP_ID = 'bf51a910020fa25a';
const CENTRO_PADRAO: [number, number] = [-16.0669, -57.6868]; // Cuiabá

export interface LocalEscolhido {
  /** Nome curto (vai para o campo "Local"). */
  nome: string;
  /** Endereço completo. */
  endereco: string;
}

interface Props {
  open: boolean;
  /** Endereço já preenchido no formulário, exibido como confirmação. */
  endereco: string;
  onPick: (local: LocalEscolhido) => void;
  onClose: () => void;
}

/** Campo de busca do Places (API nova: AutocompleteSuggestion + Place). */
const PlaceAutocomplete = ({ onPlaceSelect }: { onPlaceSelect: (p: google.maps.places.Place) => void }) => {
  const [inputValue, setInputValue] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const places = useMapsLibrary('places');
  const [sessionToken, setSessionToken] = useState<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!places) return;
    // setState fora do corpo síncrono do efeito: evita render em cascata.
    (async () => { setSessionToken(new places.AutocompleteSessionToken()); })();
  }, [places]);

  const buscar = async (input: string) => {
    if (!input || !places) {
      setPredictions([]);
      return;
    }
    try {
      const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionToken ?? undefined,
        includedRegionCodes: ['BR'],
        locationBias: new google.maps.LatLngBounds({ lat: -17.0, lng: -58.0 }, { lat: -15.0, lng: -56.0 }),
      });
      setPredictions(suggestions || []);
    } catch (err) {
      console.error('Erro no autocomplete de lugares:', err);
    }
  };

  const selecionar = async (s: google.maps.places.AutocompleteSuggestion) => {
    if (!places || !s.placePrediction) return;
    setInputValue(s.placePrediction.text.text);
    setPredictions([]);

    const place = s.placePrediction.toPlace();
    await place.fetchFields({ fields: ['location', 'displayName', 'formattedAddress'] });
    onPlaceSelect(place);
  };

  return (
    <div className="relative">
      <div className="relative group">
        <input
          type="text"
          placeholder="Pesquisar local ou endereço..."
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); buscar(e.target.value); }}
          className="w-full h-12 bg-white/90 backdrop-blur-md border border-glassBorder rounded-xl px-12 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-textLight"
        />
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40" size={18} />
        {inputValue && (
          <button
            type="button"
            onClick={() => { setInputValue(''); setPredictions([]); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/20 hover:text-primary transition-colors"
            title="Limpar Pesquisa"
            aria-label="Limpar Pesquisa"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-glassBorder rounded-2xl shadow-md z-[120] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {predictions.map((p, idx) => (
            <button
              key={p.placePrediction?.placeId || idx}
              type="button"
              className="w-full text-left px-5 py-3 hover:bg-primary/5 text-xs border-b border-glassBorder last:border-0 flex flex-col gap-0.5"
              onClick={() => selecionar(p)}
            >
              <span className="font-semibold text-textLight">{p.placePrediction?.text.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Recentraliza o mapa e captura o clique do usuário para marcar o ponto. */
const MapaInterativo = ({
  centro,
  onClick,
}: {
  centro: [number, number];
  onClick: (lat: number, lng: number) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    if (map) map.panTo({ lat: centro[0], lng: centro[1] });
  }, [map, centro]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      const pos = e.latLng?.toJSON();
      if (pos) onClick(pos.lat, pos.lng);
    });
    return () => listener.remove();
  }, [map, onClick]);

  return null;
};

export const LocationPickerModal = ({ open, endereco, onPick, onClose }: Props) => {
  const [centro, setCentro] = useState<[number, number]>(CENTRO_PADRAO);
  const [marcador, setMarcador] = useState<[number, number] | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEscapeToClose(open, onClose);

  // Geocodificação reversa do ponto clicado. Nominatim é gratuito e não exige chave;
  // o Google já está carregado, mas o Geocoding é cobrado à parte.
  const enderecoPorCoordenada = async (lat: number, lng: number) => {
    setMarcador([lat, lng]);
    setBuscando(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await resp.json();
      onPick({
        nome: data.address?.road || data.address?.suburb || 'Local Selecionado',
        endereco: data.display_name || '',
      });
    } catch (error) {
      console.error('Erro ao buscar endereço pelas coordenadas:', error);
    } finally {
      setBuscando(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[99999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-map-title"
    >
      <div className="bg-background w-full max-w-lg h-[80vh] rounded-3xl border border-glassBorder shadow-md flex flex-col p-6 relative overflow-hidden animate-in zoom-in duration-300">
        <div className="flex justify-between items-center mb-4">
          <div className="text-left">
            <h3 id="create-map-title" className="font-display font-semibold text-xl text-textLight">Escolher localização</h3>
            <p className="text-xs text-textMuted">Busque ou clique no mapa para marcar</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-primary/10 p-2.5 rounded-full text-primary hover:bg-primary/20 hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="Fechar Mapa"
            aria-label="Fechar Mapa"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative flex-1 rounded-2xl overflow-hidden border border-glassBorder bg-primary/5 shadow-inner flex flex-col">
          <div className="absolute top-4 left-4 right-4 z-20">
            <PlaceAutocomplete
              onPlaceSelect={(place) => {
                // API nova do Places: `location`/`displayName`/`formattedAddress`.
                // (O código antigo lia `place.geometry.location`, do formato legado,
                //  e por isso a busca nunca preenchia o endereço.)
                const loc = place.location;
                if (!loc) return;
                const lat = loc.lat();
                const lng = loc.lng();
                setCentro([lat, lng]);
                setMarcador([lat, lng]);
                onPick({
                  nome: place.displayName || '',
                  endereco: place.formattedAddress || place.displayName || '',
                });
              }}
            />
          </div>

          <Map
            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            mapId={GOOGLE_MAP_ID}
            defaultCenter={{ lat: centro[0], lng: centro[1] }}
            defaultZoom={15}
            gestureHandling="greedy"
            disableDefaultUI
          >
            <MapaInterativo centro={centro} onClick={enderecoPorCoordenada} />
            {marcador && <AdvancedMarker position={{ lat: marcador[0], lng: marcador[1] }} />}
          </Map>
        </div>

        {buscando && (
          <div className="flex items-center justify-center gap-2 mt-4 text-primary">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs font-medium">Buscando endereço...</span>
          </div>
        )}

        {endereco && (
          <div className="mt-4 p-3.5 bg-surface border border-glassBorder rounded-2xl flex items-start gap-2.5 text-left">
            <MapPin className="text-primary shrink-0 mt-0.5" size={16} />
            <div className="min-w-0">
              <span className="text-xs font-medium text-textMuted block">Endereço selecionado</span>
              <p className="font-sans font-semibold text-xs text-textLight truncate leading-snug">{endereco}</p>
            </div>
          </div>
        )}

        <Button
          type="button"
          fullWidth
          className="mt-4 rounded-xl py-3.5"
          onClick={onClose}
          disabled={!endereco}
        >
          Confirmar localização
        </Button>
      </div>
    </div>
  );
};
