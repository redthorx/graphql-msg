# Graphql-msg

From graphql-yoga example

to use:

## install dependancies
```
npm i
```

## run DB migrations

```
npx prisma db pull
```

## run server

```
npm run dev
```

Only allUsers API endpoint is accessible without logging in.

To log in, perform loginUser mutation, and add the 'token' to 'Authorization' header at the headers tab (at the bottom of the page) in the following way:

```
{
  "Authorization": "Bearer __YOUR_TOKEN"
}
```
