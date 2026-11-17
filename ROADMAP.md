# Missione e blocchi di sviluppo

## Missione di riferimento

Direzione ricavata dal README e dal prototipo esistente: permettere di esplorare
e guidare nel centro reale di Casale Monferrato, con geometrie geografiche
riconoscibili, guida arcade fluida e funzionamento locale senza servizi durante
la partita. La fedeltà dei dati e la qualità della guida precedono l'espansione
della mappa e l'aggiunta di contenuti.

## Blocco 1 — Fluidità e solidità della guida (priorità immediata)

- Già presenti: simulazione a passo fisso, interpolazione, minimappa precalcolata,
  geometrie statiche raggruppate e collisioni orientate con cortili.
- Implementato in questo intervento: indice spaziale statico degli edifici, con
  selezione dei candidati su tutto il movimento prima dei controlli precisi.
  I limiti degli edifici sono condivisi con i controlli dello spawn.
- Verifica automatica: confronto dei contatti indicizzati con la scansione
  completa della città reale, bordi delle celle e coordinate negative; regressioni
  esistenti per vicoli, muri sottili, rotazione, retromarcia e limiti della mappa.
- Implementato: `npm run benchmark`, replay di 60 secondi ripetuto cinque volte
  con verifica di determinismo e misure CPU separate per fisica e camera.
- Da completare: misurazione dei tempi di frame in browser su un percorso
  ripetibile, con browser, hardware e dimensione della finestra dichiarati.
- Uscita dal blocco: nessuna regressione nei contatti e misure riproducibili;
  la riduzione dei candidati non costituisce da sola una promessa di FPS.

Verifica del 17 novembre 2026: tutti i 31 test e la build TypeScript/Vite passano.
Il campionamento della città reale confronta tre orientamenti ogni 17 metri:
nessuna differenza nei contatti e candidati medi inferiori al 10% degli edifici.
Resta l'avviso Vite sul bundle 3D superiore a 500 kB. Le prestazioni grafiche e
le interazioni in browser non sono state misurate in questo intervento.

### Incremento successivo — 17 novembre 2026

35 test e build superati. Il [report CPU](docs/benchmarks/2026-11-17.json) registra
Node 22.16.0 su Apple M4: p95 di circa 0,0015 ms per tick fisico e 0,020 ms per
controllo camera nel replay. I 7.012 controlli lungo la rete stradale, in quattro
direzioni, hanno p95 di circa 0,035 ms e 2.206 correzioni. Sono misure locali,
con cache calde e overhead del timer, non una comparazione né una garanzia di FPS.
La verifica grafica resta aperta: l'ultima apertura in Chrome ha segnalato WebGL
non disponibile. Il blocco 1 resta quindi aperto per la parte di rendering.

## Blocco 2 — Leggibilità e comfort della città

- Implementata la riduzione della distanza della camera nelle modalità di guida:
  controlli dopo lo smorzamento, rispetto di altezze e cortili, margine di 0,4 m
  e campioni distanti al massimo 0,2 m. È un'approssimazione conservativa;
  la panoramica libera non usa questo vincolo. Verifica visiva ancora da eseguire.
- Migliorare le geometrie degli incroci preservando larghezze e provenienza OSM.
- Verificare in browser orbita, zoom, passaggio panoramica/guida e pausa.
- Uscita: percorso di prova tra strade strette e piazze senza camera nei muri,
  buchi nelle superfici o regressioni dei comandi.

## Blocco 3 — Estensione sostenibile della mappa

- Definire chunk caricabili, budget di memoria e livelli di dettaglio.
- Gestire insieme caricamento delle geometrie e disponibilità delle collisioni.
- Ampliare i dati soltanto dopo aver misurato caricamento e fluidità; rivedere
  la proiezione geografica se l'estensione lo richiede.
- Uscita: attraversamento dei confini tra chunk senza vuoti guidabili o contatti
  mancanti, con misure prima/dopo sulla stessa macchina.

## Blocco 4 — Identità locale e contenuti

- Punti di riferimento, vegetazione e terreno compatibili con i dati disponibili.
- Audio motore procedurale disponibile: minimo, carico, cinque marce simulate,
  retromarcia, volume e silenziamento in pausa/vista città.
- Successivamente: percorsi/obiettivi di guida, ulteriori effetti audio e modalità di input.
- Traffico e pedoni richiedono una progettazione dedicata dopo i blocchi precedenti.
- Uscita: un percorso riconoscibile e completo, con asset e attribuzioni verificati.

## Regole per proseguire

Ogni incremento deve restare giocabile, includere controlli pertinenti e aggiornare
questa roadmap. Nessuna espansione geografica prima delle misure del blocco 1.
La città è attualmente statica: per cambiare edifici a runtime occorre sostituire
l'array e gli oggetti modificati, così da ricostruire indice e limiti memorizzati.
