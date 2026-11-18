# Avatars 3D – génération des données

`assets/avatar.bin` et `assets/avatar.json` sont générés à partir de **MakeHuman** (licence **CC0**) :
maillage de base `hm08`, cibles de morphologie (sexe, origine, musculature, corpulence, taille, proportions)
et poids du squelette par défaut.

## Régénérer

```bash
D=/tmp/mh && mkdir -p $D/t && cd $D
R=https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data
curl -sSO $R/3dobjs/base.obj && curl -sSO $R/rigs/default_weights.mhw
for g in female male; do
  for e in african asian caucasian; do curl -sS -o t/e-$e-$g.target $R/targets/macrodetails/$e-$g-young.target; done
  for m in minmuscle-averageweight maxmuscle-averageweight averagemuscle-minweight averagemuscle-maxweight; do
    curl -sS -o t/u-$g-$m.target $R/targets/macrodetails/universal-$g-young-$m.target; done
  for h in minheight maxheight; do curl -sS -o t/h-$g-$h.target $R/targets/macrodetails/height/$g-young-averagemuscle-averageweight-$h.target; done
  curl -sS -o t/p-$g-ideal.target $R/targets/macrodetails/proportions/$g-young-averagemuscle-averageweight-idealproportions.target
done
python3 tools/avatar/parse.py $D
python3 tools/avatar/build.py $D assets tools/avatar/rules.json
```

`rules.json` décrit les zones de chaque vêtement (brassière, crop top, débardeurs, t-shirt, cycliste,
legging, shorts, chaussures, cheveux…) sous forme de marges signées : `&` = intersection, `|` = union, `~` = exclusion.
