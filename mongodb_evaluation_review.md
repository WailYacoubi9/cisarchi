# MongoDB TP Section 7 - Review and Corrections

## Test Environment Setup (Instructions)

Since MongoDB is not available locally, here's how to test these queries:

```bash
# Option 1: Using Docker
docker run -d -p 27017:27017 --name mongodb-test mongo:latest
mongoimport --db testdb --collection movies --file movies.json --jsonArray
mongosh testdb

# Option 2: Connect to remote server
mongosh "mongodb://mongodb.ensimag.fr/<login>" -u <login> -p
```

## Question E1: updateOne() vs replaceOne()

### ✅ CORRECT - Well explained

The answer correctly identifies:
- **updateOne()**: Uses operators like $set, $inc, $push to modify specific fields
- **replaceOne()**: Replaces the entire document except _id
- Risks: Data loss, schema inconsistency, difficulty in rollback

**Additional note**: The answer could mention that replaceOne() does NOT accept update operators.

---

## Question E2: Aggregation by Decade

### ⚠️ PARTIALLY CORRECT - Complex but functional

The provided query:
```javascript
db.movies.aggregate([
  {
    $addFields: {
      decade: {
        $concat: [
          { $toString: { $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] } },
          "-",
          { $toString: { $add: [{ $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] }, 9] } }
        ]
      }
    }
  },
  {
    $group: {
      _id: "$decade",
      nombreFilms: { $sum: 1 },
      dureeMoyenne: { $avg: "$duration" }
    }
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id: 0,
      decennie: "$_id",
      nombreFilms: 1,
      dureeMoyenne: { $round: ["$dureeMoyenne", 1] }
    }
  }
])
```

**Issues**:
1. Overly complex string concatenation
2. String sorting ("1990-1999" comes after "2010-2019" alphabetically)

**Corrected version**:
```javascript
db.movies.aggregate([
  {
    $group: {
      _id: {
        $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10]
      },
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

**Why this is better**:
- Groups by numeric decade (1990, 2000, 2010)
- Sorts numerically first, then formats as string
- Simpler and more efficient

---

## Question E3: $lookup vs Embedding

### ✅ EXCELLENT - Comprehensive analysis

The answer provides:
- Clear advantages/disadvantages for both approaches
- Correct understanding of performance implications
- Good recommendations based on use cases

**Key points verified**:
- ✅ $lookup is indeed costly (left outer join operation)
- ✅ 16MB document limit is correct
- ✅ Atomicity benefits of embedding are real
- ✅ Recommendations are sound

---

## Question E4: Schema Flexibility

### ✅ CORRECT - Good examples

The answer correctly explains:
- Why MongoDB allows different schemas (agility, evolution)
- Good use case: E-commerce with heterogeneous products
- Problem case: Financial data requiring strict validation

**Could add**:
- Mention of MongoDB schema validation since version 3.6:
```javascript
db.createCollection("movies", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "director", "year"],
      properties: {
        year: { bsonType: "int", minimum: 1888 },
        duration: { bsonType: "int", minimum: 1 }
      }
    }
  }
})
```

---

## Question E5: Queries on Genres

### ⚠️ NEEDS CORRECTION

**Part 1: Exactly 3 genres**
```javascript
db.movies.find({ genres: { $size: 3 } })
```
✅ **CORRECT**

**Part 2: Common genres with Inception**
```javascript
var inceptionGenres = db.movies.findOne({ title: "Inception" }).genres
db.movies.find({
  title: { $ne: "Inception" },
  genres: { $in: inceptionGenres }
})
```
✅ **CORRECT** but could be simplified

**Issue with the explanation table**: The $size example shows `{ $size: 3 }` but this should be `genres: { $size: 3 }`

**Operator comparison - CORRECTED**:

| Opérateur | Description | Exemple sur genres |
|-----------|-------------|-------------------|
| `$size` | Tableau avec exactement N éléments | `{ genres: { $size: 3 } }` |
| `$in` | Au moins une valeur du champ est dans la liste | `{ genres: { $in: ["Sci-Fi", "Drama"] } }` |
| `$all` | Le tableau contient toutes les valeurs spécifiées | `{ genres: { $all: ["Sci-Fi", "Drama"] } }` |
| `$elemMatch` | Au moins un élément satisfait toutes les conditions | `{ ratings: { $elemMatch: { source: "IMDb", score: { $gte: 80 } } } }` |

**Additional query examples for clarity**:

```javascript
// Films with exactly 3 genres (should match: The Dark Knight, La La Land, Dunkirk)
db.movies.find({ genres: { $size: 3 } }).count()
// Expected: 3

// Films with Sci-Fi OR Thriller (same as $in)
db.movies.find({
  genres: { $in: ["Sci-Fi", "Thriller"] }
}).count()
// Expected: Many films

// Films with BOTH Sci-Fi AND Thriller (using $all)
db.movies.find({
  genres: { $all: ["Sci-Fi", "Thriller"] }
}).count()
// Expected: Inception, Blade Runner 2049, Dunkirk (if it had Sci-Fi)

// Films with more than 2 genres using $expr
db.movies.find({
  $expr: { $gt: [{ $size: "$genres" }, 2] }
})
```

---

## Summary of Corrections Needed

### Critical Issues:
1. **E2**: The sorting will not work correctly with string decades. Use numeric grouping first.

### Minor Improvements:
1. **E1**: Add note about replaceOne() not accepting update operators
2. **E4**: Mention MongoDB schema validation feature
3. **E5**: Fix operator example table to include field names

### Overall Assessment:
- **E1**: ✅ Excellent (95%)
- **E2**: ⚠️ Functional but flawed (70%) - **NEEDS CORRECTION**
- **E3**: ✅ Excellent (100%)
- **E4**: ✅ Very Good (90%)
- **E5**: ✅ Good (85%)

---

## Testing Checklist

When MongoDB is available, test:

- [ ] E2 decade aggregation with sample data
- [ ] Verify decade sorting is numeric, not alphabetic
- [ ] E5 exact 3 genres (should return 3 movies: The Dark Knight, La La Land, Dunkirk)
- [ ] E5 common genres with Inception (should return multiple Sci-Fi and Thriller movies)
- [ ] E5 $expr with $size for "more than 2 genres"

---

## Recommended Test Script

```javascript
// Connect to test database
use testdb

// Import data (run from shell)
// mongoimport --db testdb --collection movies --file movies.json --jsonArray

// Test E2 - Decade aggregation (ORIGINAL - has issues)
print("\n=== E2 Original (String sorting issue) ===")
db.movies.aggregate([
  {
    $addFields: {
      decade: {
        $concat: [
          { $toString: { $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] } },
          "-",
          { $toString: { $add: [{ $multiply: [{ $floor: { $divide: ["$year", 10] } }, 10] }, 9] } }
        ]
      }
    }
  },
  {
    $group: {
      _id: "$decade",
      nombreFilms: { $sum: 1 },
      dureeMoyenne: { $avg: "$duration" }
    }
  },
  { $sort: { _id: 1 } }
]).forEach(printjson)

// Test E2 - Decade aggregation (CORRECTED)
print("\n=== E2 Corrected (Numeric sorting) ===")
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
]).forEach(printjson)

// Test E5 - Exactly 3 genres
print("\n=== E5 Exactly 3 genres ===")
db.movies.find(
  { genres: { $size: 3 } },
  { title: 1, genres: 1, _id: 0 }
).forEach(printjson)

// Test E5 - Common genres with Inception
print("\n=== E5 Common genres with Inception ===")
var inceptionGenres = db.movies.findOne({ title: "Inception" }).genres
print("Inception genres: " + inceptionGenres)
db.movies.find(
  {
    title: { $ne: "Inception" },
    genres: { $in: inceptionGenres }
  },
  { title: 1, genres: 1, _id: 0 }
).forEach(printjson)

// Test E5 - More than 2 genres using $expr
print("\n=== E5 More than 2 genres ===")
db.movies.find(
  { $expr: { $gt: [{ $size: "$genres" }, 2] } },
  { title: 1, genres: 1, _id: 0 }
).forEach(printjson)
```
