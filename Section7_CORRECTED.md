# TP NoSQL - MongoDB
# Section 7 : Évaluation - VERSION CORRIGÉE

---

## Question E1 : updateOne() vs replaceOne()

### Comparaison des opérations

| Aspect | updateOne() | replaceOne() |
|--------|-------------|--------------|
| **Comportement** | Modifie des champs spécifiques avec des opérateurs ($set, $inc, $push, etc.) | Remplace entièrement le document (sauf _id) |
| **Syntaxe** | Utilise des opérateurs de mise à jour | Nouveau document complet **sans opérateurs** |
| **Préservation** | Conserve les champs non mentionnés | Supprime tous les champs non spécifiés |
| **Cas d'usage** | Mise à jour partielle | Remplacement total du document |

### Exemples de code

**updateOne() - Modification ciblée :**
```javascript
db.movies.updateOne(
  { title: "Inception" },
  {
    $set: { director: "C. Nolan" },
    $currentDate: { lastModified: true }
  }
)
// Résultat : Seuls director et lastModified sont modifiés
// Tous les autres champs (genres, cast, ratings, etc.) restent intacts
```

**replaceOne() - Remplacement complet :**
```javascript
db.movies.replaceOne(
  { movie_id: "m99999" },
  {
    title: "New Movie",
    director: "Jane Doe",
    year: 2024,
    genres: ["Drama"]
  }
)
// Résultat : Le document ne contient PLUS QUE ces 4 champs
// budget, boxOffice, cast, ratings, etc. sont SUPPRIMÉS !
```

### Quand utiliser l'une plutôt que l'autre ?

**Utiliser updateOne() quand :**
- Vous voulez modifier quelques champs spécifiques
- Vous voulez ajouter/supprimer des éléments dans un tableau ($push, $pull)
- Vous voulez incrémenter/décrémenter des valeurs ($inc, $mul)
- Vous voulez préserver la structure existante du document

**Utiliser replaceOne() quand :**
- Vous voulez remplacer complètement le document
- Vous avez déjà un nouveau document complet à jour
- Vous migrez d'un schéma à un autre
- Le document actuel est obsolète et doit être totalement remplacé

### Risques de replaceOne()

1. **Perte de données** : Tous les champs non inclus dans le nouveau document sont supprimés **définitivement**
2. **Oubli de champs** : Risque d'omettre des champs importants comme `budget`, `boxOffice`, `ratings`
3. **Incohérence de schéma** : Le nouveau document peut avoir une structure totalement différente
4. **Difficulté de rollback** : Sans sauvegarde préalable, impossible de récupérer les données perdues
5. **Erreur courante** : `replaceOne()` n'accepte PAS les opérateurs de mise à jour

**⚠️ ERREUR FRÉQUENTE :**
```javascript
// ❌ CECI NE FONCTIONNE PAS !
db.movies.replaceOne(
  { title: "Inception" },
  { $set: { director: "C. Nolan" } }  // ← Erreur : replaceOne n'accepte pas $set
)

// ✅ Utiliser updateOne à la place
db.movies.updateOne(
  { title: "Inception" },
  { $set: { director: "C. Nolan" } }
)
```

---

## Question E2 : Agrégation par décennie

Cette requête calcule le nombre de films et la durée moyenne par décennie :

```javascript
db.movies.aggregate([
  {
    $group: {
      _id: { $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] },
      nombreFilms: { $sum: 1 },
      dureeMoyenne: { $avg: "$duration" }
    }
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id: 0,
      decennie: {
        $concat: [
          { $toString: "$_id" },
          "-",
          { $toString: { $add: ["$_id", 9] } }
        ]
      },
      nombreFilms: 1,
      dureeMoyenne: { $round: ["$dureeMoyenne", 1] }
    }
  }
])
```

### Explication du pipeline

1. **$group** : Regroupe par décennie (nombre entier)
   - Calcul : `floor(year / 10) * 10` → 2014 devient 2010, 1998 devient 1990
   - `_id` est un nombre (1990, 2000, 2010, etc.)
   - Compte les films avec `$sum: 1`
   - Calcule la durée moyenne avec `$avg: "$duration"`

2. **$sort** : Trie par `_id` croissant
   - Tri **numérique** car `_id` est un nombre
   - Ordre chronologique garanti (1990, 2000, 2010, 2020)

3. **$project** : Formate le résultat final
   - Convertit `_id` numérique en chaîne "1990-1999"
   - Arrondit la durée moyenne à 1 décimale
   - Supprime `_id` du résultat final

### ⚠️ Importance de l'ordre des opérations

**CORRECT (cette version) :**
```javascript
$group par NOMBRE (1990, 2000, 2010)
→ $sort par NOMBRE (tri chronologique)
→ $project convertit en CHAÎNE ("1990-1999")
```

**INCORRECT (à éviter) :**
```javascript
$group par CHAÎNE ("1990-1999", "2000-2009")
→ $sort par CHAÎNE (tri alphabétique)
   ❌ Problème : "2010-2019" vient après "1990-1999" alphabétiquement
   mais "2000-2009" vient AVANT "1990-1999" !
```

### Résultat attendu

```javascript
{ decennie: "1990-1999", nombreFilms: 3, dureeMoyenne: 144.0 }
{ decennie: "2000-2009", nombreFilms: 3, dureeMoyenne: 135.3 }
{ decennie: "2010-2019", nombreFilms: 12, dureeMoyenne: 125.4 }
```

---

## Question E3 : $lookup vs Embedding

### (a) Utilisation de $lookup (références)

**Avantages :**
1. **Pas de duplication** : Les données du film ne sont stockées qu'une seule fois
2. **Mises à jour simplifiées** : Modifier un film met à jour automatiquement toutes les jointures
3. **Taille de document maîtrisée** : Les critiques nombreuses ne font pas exploser la taille du document film
4. **Flexibilité des requêtes** : Possibilité de requêter les critiques indépendamment

**Inconvénients :**
1. **Performance** : $lookup est coûteux car il effectue une jointure à l'exécution (équivalent LEFT OUTER JOIN)
2. **Complexité** : Requêtes d'agrégation plus complexes à écrire et maintenir
3. **Pas de transactions ACID par défaut** : L'intégrité référentielle n'est pas garantie (MongoDB >= 4.0 supporte les transactions multi-documents)

**Exemple :**
```javascript
// Collection movies
{ _id: ObjectId(...), movie_id: "m40001", title: "Inception", ... }

// Collection reviews
{ _id: ObjectId(...), movie_id: "m40001", user_id: "u789", rating: 9, ... }

// Jointure avec $lookup
db.reviews.aggregate([
  {
    $lookup: {
      from: "movies",
      localField: "movie_id",
      foreignField: "movie_id",
      as: "movie_details"
    }
  }
])
```

### (b) Embedding (critiques dans movies)

**Avantages :**
1. **Performance de lecture** : Toutes les données en une seule requête, pas de jointure
2. **Atomicité** : Les mises à jour d'un document sont atomiques (ACID au niveau document)
3. **Simplicité** : Modèle de données plus intuitif et requêtes plus simples
4. **Localité des données** : Données liées stockées ensemble physiquement

**Inconvénients :**
1. **Limite de taille** : MongoDB limite les documents à **16 Mo** - problème si beaucoup de critiques
2. **Duplication potentielle** : Si les mêmes critiques apparaissent ailleurs
3. **Requêtes sur critiques seules** : Plus difficile d'analyser les critiques indépendamment des films
4. **Croissance illimitée** : Le document grandit indéfiniment avec chaque nouvelle critique

**Exemple :**
```javascript
// Collection movies avec critiques embarquées
{
  _id: ObjectId(...),
  movie_id: "m40001",
  title: "Inception",
  reviews: [
    { user_id: "u789", rating: 9, review_text: "Brilliant!", date: ISODate(...) },
    { user_id: "u456", rating: 8, review_text: "Great film", date: ISODate(...) }
  ]
}
```

### Recommandation

**Privilégier $lookup (références) quand :**
- Le nombre de critiques par film est potentiellement **élevé ou illimité**
- Les critiques doivent être requêtées **indépendamment** (analyses, statistiques par utilisateur)
- Les critiques sont **fréquemment mises à jour**
- Vous avez besoin de **pagination** des critiques
- Plusieurs collections référencent les critiques

**Privilégier l'embedding quand :**
- Le nombre de critiques par film est **limité et prévisible** (ex: max 100 critiques)
- Les critiques sont **toujours lues avec le film** (pas de requêtes séparées)
- La **performance de lecture est critique**
- Les critiques sont **rarement mises à jour**
- Le document total reste bien en dessous de 16 Mo

**Règle générale :** Relations **1-to-few** → Embedding | Relations **1-to-many** → Références

---

## Question E4 : Flexibilité du schéma

### Pourquoi MongoDB permet des schémas différents

MongoDB est une base de données orientée document qui adopte un modèle **"schema-flexible"** (ou "schema-less"). Cela signifie que chaque document dans une collection peut avoir une structure différente. Cette conception répond à plusieurs besoins :

- **Évolution rapide** des applications sans migration de schéma
- **Stockage de données hétérogènes** provenant de sources diverses
- **Prototypage rapide** et développement agile
- **Adaptation aux besoins métier** : Les données suivent le modèle applicatif, pas l'inverse

### Exemple où la flexibilité est utile

**Cas : Catalogue de produits e-commerce**

Différents types de produits ont des attributs spécifiques :

```javascript
// Livre
{
  type: "livre",
  titre: "MongoDB Guide",
  auteur: "John Doe",
  pages: 350,
  isbn: "978-1234567890",
  editeur: "TechBooks"
}

// Vêtement
{
  type: "vetement",
  nom: "T-shirt",
  taille: "M",
  couleur: "bleu",
  matiere: "coton",
  lavage: "30°C"
}

// Électronique
{
  type: "electronique",
  nom: "Laptop",
  marque: "TechBrand",
  cpu: "Intel i7",
  ram: "16GB",
  garantie: 24,
  ports: ["USB-C", "HDMI", "Jack 3.5mm"]
}
```

**Avantages :**
- Pas de colonnes NULL inutiles (un livre n'a pas de "taille", un vêtement n'a pas de "pages")
- Ajout facile de nouveaux types de produits sans modifier le schéma
- Chaque type de produit a exactement les champs dont il a besoin

### Exemple où la flexibilité pose problème

**Cas : Données financières réglementées**

Pour des transactions bancaires, l'absence de schéma strict peut causer :

1. **Incohérences de données**
   ```javascript
   { montant: 100, devise: "EUR" }      // français
   { amount: 100, currency: "USD" }     // anglais
   { prix: 100, monnaie: "CHF" }        // mixte
   ```

2. **Erreurs de type**
   ```javascript
   { montant: "100" }       // string au lieu de number
   { montant: 100.50 }      // number correct
   { montant: "100,50" }    // string avec virgule
   ```

3. **Champs manquants**
   ```javascript
   { id_transaction: "T123", montant: 100 }            // OK
   { id_transaction: "T124" }                           // Montant manquant !
   { montant: 150, date: ISODate(...) }                 // ID manquant !
   ```

4. **Problèmes d'audit**
   - Difficulté à garantir la conformité réglementaire (RGPD, SOX, PCI-DSS)
   - Impossible de vérifier que tous les documents ont les champs requis
   - Risque de corruption de données silencieuse

### Solution : Validation de schéma MongoDB

Depuis MongoDB 3.6, on peut imposer des contraintes avec **JSON Schema Validation** :

```javascript
db.createCollection("transactions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_transaction", "montant", "devise", "date", "client_id"],
      properties: {
        id_transaction: {
          bsonType: "string",
          description: "Identifiant unique obligatoire"
        },
        montant: {
          bsonType: "decimal",
          minimum: 0,
          description: "Montant positif en décimal"
        },
        devise: {
          enum: ["EUR", "USD", "GBP", "CHF"],
          description: "Devise valide uniquement"
        },
        date: {
          bsonType: "date",
          description: "Date de transaction obligatoire"
        },
        client_id: {
          bsonType: "string",
          pattern: "^[A-Z]{2}[0-9]{6}$",
          description: "ID client au format XX123456"
        },
        statut: {
          enum: ["en_attente", "validee", "annulee"],
          description: "Statut optionnel mais valeurs contrôlées"
        }
      }
    }
  },
  validationAction: "error",  // Rejette les documents invalides
  validationLevel: "strict"   // Valide toutes les insertions et mises à jour
})
```

**Résultat :**
```javascript
// ✅ Accepté
db.transactions.insertOne({
  id_transaction: "T00123",
  montant: NumberDecimal("150.50"),
  devise: "EUR",
  date: new Date(),
  client_id: "FR123456"
})

// ❌ Rejeté : montant négatif
db.transactions.insertOne({
  id_transaction: "T00124",
  montant: NumberDecimal("-50.00"),
  devise: "EUR",
  date: new Date(),
  client_id: "FR123457"
})
// Erreur : Document failed validation

// ❌ Rejeté : champ obligatoire manquant
db.transactions.insertOne({
  id_transaction: "T00125",
  montant: NumberDecimal("200.00"),
  devise: "EUR"
  // Manque date et client_id
})
// Erreur : Document failed validation
```

### Conclusion

La flexibilité de schéma de MongoDB est une fonctionnalité puissante qui :
- **Facilite** le développement agile et l'évolution des applications
- **Nécessite** une discipline pour éviter l'anarchie des données
- **Peut être contrôlée** avec la validation de schéma quand nécessaire

**Règle d'or :** Flexibilité ne signifie pas anarchie. Utilisez la validation pour les données critiques.

---

## Question E5 : Requêtes sur les genres

### Partie 1 : Films avec exactement 3 genres

```javascript
db.movies.find({ genres: { $size: 3 } })
```

**Explication :**
- L'opérateur `$size` correspond aux tableaux qui ont **exactement** le nombre d'éléments spécifié
- Ne fonctionne qu'avec des valeurs exactes (pas de comparaisons comme `$gt` ou `$lt`)
- Syntaxe : `{ champ_tableau: { $size: N } }`

**Films correspondants dans notre base :**
- The Dark Knight (2008) : `["Action", "Crime", "Drama"]`
- La La Land (2016) : `["Musical", "Romance", "Drama"]`
- Dunkirk (2017) : `["War", "Drama", "Thriller"]`

### Partie 2 : Films avec au moins un genre commun avec Inception

D'abord, récupérons les genres d'Inception (`["Sci-Fi", "Thriller"]`), puis cherchons les films correspondants :

```javascript
// Méthode 1 : En deux étapes (dynamique)
var inceptionGenres = db.movies.findOne({ title: "Inception" }).genres
db.movies.find({
  title: { $ne: "Inception" },
  genres: { $in: inceptionGenres }
})

// Méthode 2 : Directement avec les valeurs connues
db.movies.find({
  title: { $ne: "Inception" },
  genres: { $in: ["Sci-Fi", "Thriller"] }
})

// Méthode 3 : Avec projection pour voir les genres en commun
var inceptionGenres = db.movies.findOne({ title: "Inception" }).genres
db.movies.find(
  {
    title: { $ne: "Inception" },
    genres: { $in: inceptionGenres }
  },
  { title: 1, genres: 1, year: 1, _id: 0 }
).sort({ year: -1 })
```

**Films correspondants :**
- Interstellar (2014) : `["Sci-Fi", "Drama"]` → Commun: Sci-Fi
- Blade Runner 2049 (2017) : `["Sci-Fi", "Thriller"]` → Commun: Sci-Fi, Thriller
- The Matrix (1999) : `["Sci-Fi", "Action"]` → Commun: Sci-Fi
- Parasite (2019) : `["Thriller", "Drama"]` → Commun: Thriller
- Dunkirk (2017) : `["War", "Drama", "Thriller"]` → Commun: Thriller
- etc.

### Différence entre les opérateurs sur tableaux

| Opérateur | Description | Exemple sur genres | Résultat |
|-----------|-------------|-------------------|----------|
| `$size` | Tableau avec **exactement** N éléments | `{ genres: { $size: 3 } }` | Films ayant exactement 3 genres |
| `$in` | Au moins **une** valeur du tableau est dans la liste | `{ genres: { $in: ["Sci-Fi", "Drama"] } }` | Films ayant Sci-Fi **OU** Drama (ou les deux) |
| `$all` | Le tableau contient **toutes** les valeurs spécifiées | `{ genres: { $all: ["Sci-Fi", "Thriller"] } }` | Films ayant Sci-Fi **ET** Thriller (peut avoir d'autres genres aussi) |
| `$elemMatch` | Au moins un élément satisfait **plusieurs conditions** | `{ ratings: { $elemMatch: { source: "IMDb", score: { $gte: 80 } } } }` | Films ayant un rating IMDb >= 80 |

### Exemples comparatifs

```javascript
// 1. $size - Exactement 2 genres
db.movies.find({ genres: { $size: 2 } })
// Résultat : Inception, Interstellar, Amélie, Pulp Fiction, etc.

// 2. $in - Contient Sci-Fi OU Thriller (ou les deux)
db.movies.find({ genres: { $in: ["Sci-Fi", "Thriller"] } })
// Résultat : Tous les films avec au moins un de ces genres
// Inception ✓ (a les deux), Interstellar ✓ (a Sci-Fi), Parasite ✓ (a Thriller)

// 3. $all - Contient Sci-Fi ET Thriller (peut en avoir d'autres)
db.movies.find({ genres: { $all: ["Sci-Fi", "Thriller"] } })
// Résultat : Seulement les films ayant LES DEUX genres
// Inception ✓, Blade Runner 2049 ✓, Interstellar ✗ (manque Thriller)

// 4. $elemMatch - Pour tableaux d'objets avec conditions multiples
db.movies.find({
  ratings: {
    $elemMatch: {
      source: "IMDb",
      score: { $gte: 85 }
    }
  }
})
// Résultat : Films avec au moins un rating IMDb >= 85
```

### Note importante : $size avec comparaisons

`$size` ne peut pas être combiné avec des opérateurs de comparaison (`$gt`, `$gte`, `$lt`, `$lte`).

```javascript
// ❌ CECI NE FONCTIONNE PAS
db.movies.find({ genres: { $size: { $gt: 2 } } })
// Erreur : $size ne supporte que des nombres entiers exacts

// ✅ Solution : Utiliser $expr avec $size (fonction d'agrégation)
db.movies.find({ $expr: { $gt: [{ $size: "$genres" }, 2] } })
// Résultat : Films avec plus de 2 genres

// Autres exemples avec $expr
db.movies.find({ $expr: { $gte: [{ $size: "$genres" }, 3] } })  // >= 3 genres
db.movies.find({ $expr: { $lt: [{ $size: "$genres" }, 2] } })   // < 2 genres
db.movies.find({ $expr: { $eq: [{ $size: "$genres" }, 1] } })   // exactement 1 genre
```

**Différence clé :**
- `$size` (opérateur de requête) : Seulement pour égalité exacte → `{ genres: { $size: 3 } }`
- `$size` (opérateur d'agrégation avec $expr) : Permet comparaisons → `{ $expr: { $gt: [{ $size: "$genres" }, 2] } }`

---

## Fin de la Section 7

**Points clés à retenir :**
1. **E1** : `updateOne()` modifie, `replaceOne()` remplace (attention aux pertes de données)
2. **E2** : Toujours grouper/trier par nombres, puis formater en chaînes
3. **E3** : $lookup pour relations 1-to-many, embedding pour 1-to-few
4. **E4** : Flexibilité utile mais discipline nécessaire (validation de schéma)
5. **E5** : Comprendre $size, $in, $all, $elemMatch et $expr pour les tableaux
