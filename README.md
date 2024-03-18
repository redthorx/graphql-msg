# Graphql-msg

From graphql-yoga example

to use:

## install dependancies
```
npm i
```

## Change DB configuration in schema.prisma from 'mssql to sqlite' by uncommenting lines in schema.prisma

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

### Gotcha's

After implementing websocket subscriptions, [the browser ignores headers in the websocket request](https://stackoverflow.com/questions/4361173/http-headers-in-websockets-client-api), thus the subscription needs to have the token in request for it to work

To prevent CSRF attacks, [a x-csrf header needs to be added in for authorized routes(https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#employing-custom-request-headers-for-ajaxapi)], if not the server will complain that it is not logged in


## CORS

set the CORS setting for cors request to either '*' for allowing all CORS request (not secure), or explicit domain pinning.

For all authenticated request, a x-csrf (or whichever you set CSRF_HEADER_NAME environment variable to) header has to be sent to prevent cross site attacks

### for writing report

Secure defaults:

```
function setCors(){
  if(!ORIGIN_SERVER){
    console.log('CORS has not been set, defaulting to same-origin. If you see this and are having CORS issues, set the ORIGIN_SERVER environment variable to your origin server, or * for catch-all')
    return false
  }
  else{
    if(ORIGIN_SERVER === '*'){
      console.warn("Warning, your cors is set to '*'. Set to your origin server for better security")
    }
    return{
      origin: ORIGIN_SERVER,
      credentials: true,
      allowedHeaders: [CSRF_HEADER_NAME],
      methods: ['OPTIONS','POST']
    }
  }
}

```

The default option is to only allow same-origin. An explicit setting has to be enabled to launch it in an insecure manner (secure defaults)