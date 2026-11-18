# 8Stations – prototype

Site en ligne (GitHub Pages) : `https://noemiegarnier64-lgtm.github.io/8stations/`

- `index.html` : l'application complète (cartes Plan / Sombre / Satellite).
- `web/8stations.html` : variante pour les pages Claude (fonds de carte intégrés, sans tuiles externes).
- `logos/` : propositions de logo (C retenu).

Ouvre `index.html` dans un navigateur (aucune installation). Calendrier : officiel (hyroxfrance.com, relevé du 18/11/2026). Hôtels, vols, salles, excursions et prix : **fictifs**.

## Écrans
- **Explorer** : choix de la course, carte (hôtels / salles / excursions) avec rayon réglable ≤ 5 km, liste triée au meilleur prix.
- **Mon package** : vol/train + hôtel + location de voiture (optionnelle) + excursions présélectionnés au meilleur prix ; aéroport de départ, dates, voyageurs, bagages, catégorie de voiture, prise en charge (aéroport / près du site) et options modifiables.
- **Mes courses** (connexion démo) : courses à venir, compte à rebours, budget estimé et épargne mensuelle conseillée.
- **Outfit** : par course, format solo / duo femmes / duo hommes / duo mixte ; tenues identiques ou couleurs inversées (haut ↔ bas) en duo, short homme assorti en mixte ; looks prêts à porter, couleurs, coupes ; avatars avec photo du visage (gardée sur l'appareil) et teinte de peau ; enregistrement par course.
- **Prépa J-7 (Premium)** : plan jour par jour entraînement / hydratation / nutrition / sommeil + rappels.

## Passage en production (API à brancher)
| Besoin | Option recommandée |
|---|---|
| Hôtels | Booking.com Demand API / Expedia Rapid (statut partenaire requis) ; au départ : liens affiliés |
| Vols | Duffel (réservation réelle) ; au départ : Skyscanner / Kiwi en affiliation |
| Location de voiture | Rentalcars.com (affiliation Booking) / Discover Cars ; API : CarTrawler (partenaire) |
| Excursions | GetYourGuide Partner API (sur candidature) ou widget affilié GetYourGuide |
| Salles de sport | OpenStreetMap Overpass (`leisure=fitness_centre`, gratuit) ou Google Places |
| Carte | Leaflet + OSM/CARTO, ou Mapbox |
| Calendrier des courses | Pas d'API publique officielle : base maintenue à la main / partenariat |
| Auth / BDD | Supabase ou Firebase |
| Paiement premium | Stripe (web) + achats intégrés (iOS/Android) |

## Stack cible web + mobile
Next.js (React) + Capacitor pour iOS/Android, ou Expo (React Native + web) — un seul code pour le site et l'app.
