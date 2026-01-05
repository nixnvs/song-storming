// Script to import reference tracks from the provided URIs
// Run this with: node import_reference_tracks.js

// Track URIs extracted from your reference playlists
const referenceTrackURIs = [
  'spotify:track:5eksCJ1r2T1kNIZPTHBGG2', // Criançada (con Castello Branco)
  'spotify:track:7Ma65Rw2NITbTtYTwsbtWe', // Fuego al cielo
  'spotify:track:6UDWsYMH2MwgOxOS9sbnwC', // Batismo
  'spotify:track:4rplK4ylZurvDv5plS2dVS', // Last Chance
  'spotify:track:1ivudlcJhIrbaaCfTejxgo', // Deelahli
  'spotify:track:7v6J8Mbbe7wXOxLpClhcxZ', // Algarrobo
  'spotify:track:2hgMOGC9WAqm8ZoBDD3HIY', // Fading into Purple
  'spotify:track:5sYEZITdvQWTILUAjpFfte', // Civilización y Barbarie (Acústico)
  'spotify:track:2IaK9nX9hppWtGD1a2Qvwc', // Tlacotlan
  'spotify:track:0hh8kMA8Zk4UeUcRXQcQ9f', // Jocotoco Antpitta
  'spotify:track:60xDI4MpVs14Hq1r6Dd97g', // El llamado de la montaña
  'spotify:track:5W7KfVKwst9nwMnQWP2SQE', // Chan Chara
  'spotify:track:2mHvhHcRty3VDjUowCSTqP', // Minca
  'spotify:track:7hjxr2ilZclqIZgbZt56ld', // Equilibrio
  'spotify:track:7IMU8eXXQnXiWChljmRlxh', // Xica Xica
  'spotify:track:01zXE0b1NQGrC0dhoClo20', // Paruma
  'spotify:track:2Ca2Naoxh4TQzSN5X2bKTh', // Al abrigo del vino
  'spotify:track:10OuarFuuSd2zVkYJlg4ME', // El niño
  'spotify:track:5J4vGQ2ZJT1g9D2yfBf8jF', // Selva
  'spotify:track:6wAUhtjy0KgCdzQjaBAsnT', // Los Hijos De Fierro
  'spotify:track:3yX0yyoo11ICzD5scmSxRa', // Canción de la Nostalgia
  'spotify:track:6BANbz1D6XLOHIVorphUlc', // Monte
  'spotify:track:4WF9rzBLxY2lho92eDZgv7', // Miniyamba
  'spotify:track:0paxaZbm4upQxy5SqYhu26', // Childhood
  'spotify:track:3lz6vfLLT0qCtf8dqWZWcL', // Aire
  'spotify:track:5byzojl27kFDPv1SMXyPdQ', // Aguas Claras
  'spotify:track:09ID9xg4JsT6Zqyg5hPgBR', // Apus
  'spotify:track:6aR1ZN01Fs828Y86RuO1g2', // Creciente
  'spotify:track:1yOhCkYRIXZF8eB4JhJvx5', // Mama Clo
  'spotify:track:67MH9hpGJQoivKhC4bu8Ow', // Omeñiso
  'spotify:track:0WOp09G4FPMOqfsrcOb5zl', // Bruma
];

console.log(`Found ${referenceTrackURIs.length} reference track URIs`);
console.log('\nTo import these tracks, use the API endpoint:');
console.log('POST /api/catalog/import');
console.log('\nWith body:');
console.log(JSON.stringify({
  type: 'track_uris',
  value: 'reference_playlist_import',
  track_uris: referenceTrackURIs
}, null, 2));

// You can also use this in the browser console or via curl:
console.log('\nOr use curl:');
console.log(`curl -X POST http://localhost:3000/api/catalog/import \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '${JSON.stringify({
  type: 'track_uris',
  value: 'reference_playlist_import',
  track_uris: referenceTrackURIs
})}'`);
