[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

# @rill/mongoose

Mongoose REST api generator for Rill with flexible defaults.

# Installation

#### Npm

```console
npm install @rill/mongoose
```

# Features

+ Feature packed default routes.
+ Automatically sanitize inputs/outputs (query/body) for hidden fields.
+ Easily override or add to default middleware.
+ Uses lean / optimized queries.
+ Good query api with many features including populate, select, limit, skip and sort.

# Example Setup

```js
const Rill = require('rill')
const resource = require('@rill/mongoose')

const app = Rill()

// Create any mongoose model.
const User = mongoose.model('user', {
	name: { type: String, required: true },
	hidden: { type: String, hidden: true } // Any fields marked as hidden will not be accessable through any part of the api.
})

// Setup a "GET/find" request for the user route using the optimized default middleware.
app.setup(resource(User, { find: 'default' }))
```

# Example Consumption

```js
// Consume using WHATWG Fetch api.
fetch('/user?$select=name&$limit=10')
	.then(res => res.json())
	.then(users => {
		/**
		 * Returns up to 10 users
		 * with only the `_id` and `name` fields selected.
		 */
	})
```

# Setup API

+ **resource([path: String], Model: Mongoose.model, methods: Object)** : Creates a REST api for the provided model with the configured methods.

```js
// Choose which methods to enable.
app.setup(resource(UserModel, {
	// `GET` requests.
	find: 'default',
	// `GET/:id` requests.
	findById: 'default',
	// `POST` requests.
	create: 'default',
	// `PUT|PATCH/:id` requests.
	save: 'default',
	// `DELETE/:id` requests.
	remove: 'default'
}))

// Add more middleware to methods (while optionally still using defaults).
app.setup(resource(PermissionsModel, {
	// Runs `restrictAdmin` middleware before the default middleware.
	find: [restrictAdmin, 'default']
}))

// Also override the default path for the handlers.
app.setup(resource('/somepath', SomeOtherModel, ...))
```

# Query API

The `querystring` is sanatized then passed into `Model.find` allowing for any sort of Mongoose style query in a safe way.

```js
fetch('/user?age=10&loggedIn[$gt]=' + new Date(2015)) // Find all users who are age 10 and have logged in after 2015.
```

#### Special Query Operators

There are some special operators to make working with the api more flexible.

+ **$skip** : skip a number of results.

```js
fetch('/user?$skip=10') // Skip the first 10 users.
```

+ **$limit** : limit the number of results.

```js
fetch('/user?$limit=10') // Get at most 10 users.
```

+ **$sort** : sort the results.

```js
fetch('/user?$sort=name email') // Sort users by name, then email.
fetch('/user?$sort=-name') // Sort users by name in descending order.
```

+ **$select** : limit the fields in the results.

```js
fetch('/user?$select=name email') // Get all users, but only with their name and email and _id.
fetch('/user?$select=name email -_id') // Same query, but omit _id this time.
```

+ **$populate** : populate related fields for the Model.

```js
fetch('/user?$populate=posts friends') // Will `populate` the `posts` and `friends` field if they are not hidden on the api for all users.

// populate specific fields. (wrap fields in "[]")
fetch('/user?$populate=posts[title date]') // `populate` posts for each user but only include the post title and date.

// nested populate. (seperate nested populate with ":")
fetch('/user?$populate=posts[author]:author[name]') // `populate` all `posts`, with only the `author` - then populate all posts authors with only their `name`.
```

# Creating documents

You can `POST` to the api to create new documents for the `Model`.

```js
// Create a new user.
fetch('/user', {
	method: 'POST',
	body: JSON.stringify({
		name: 'Cool Api Dude',
		hidden: 'Test' // Hidden fields and extra fields will be ignored.
	})
})
	.then(res => res.json())
	.then(user => {
		// New user created!
		console.log(user._id)
	})
```

# Updating documents

You can use `PUT/:id` to replace an existing document and `PATCH/:id` to update a document.

```js
// Overwrite an existing user.
fetch('/user/000000000000000000000000', {
	method: 'PUT',
	body: JSON.stringify({
		// Completely overwrite all fields.
		name: 'Cool Api Dude'
	})
})
	.then(res => res.json())
	.then(user => {
		// Updated user!
		console.log(user._id)
	})

// Update an existing user.
fetch('/user/000000000000000000000000', {
	method: 'PATCH',
	body: JSON.stringify({
		// Will only update `name` leaving other fields as is.
		name: 'Cool Api Dude'
	})
})
	.then(res => res.json())
	.then(user => {
		// Updated user!
		console.log(user._id)
	})
```

# Removing documents

You can use `DELETE/:id` to permenatly remove a document.

```js
// Remove an existing user.
fetch('/user/000000000000000000000000', { method: 'DELETE' })
	.then(res => res.json())
	.then(user => {
		// I was deleted :(.
		console.log(user._id)
	})
```

# Validation

Mongoose validation is also automatically handled for `POST|PUT|PATCH` requests.

```js
fetch('/user', {
	method: 'POST',
	body: JSON.stringify({
		name: null // This will fail because `name` is required.
	})
})
	.then(res => {
		// Automatically sets status and an error message header.
		res.status //-> 400
		res.headers.get('X-Error-Message') //-> 'Path `name` is required.'
		return res.json()
	})
	.then(ValidationError => {
		// Also sends the validation error as JSON.
	})
```

---

### Contributions

Please use `npm test` for tests and feel free to create a PR!
