# ess

ESS (Ejs Sass Server) was created because all other frameworks are so huge and confusing my brain explodes into pieces. Essentially, ESS is a glorified version of `express.static` that is able to interpret `ejs` and `sass`/`scss` files, making use of `express` or any similar library for simple webpages that just want to utilize `ejs` completely pointless.

## Usage

1. Create `ess.toml` file in your project's root directory

``` toml
name = "project name"
description = "project description"
```

2. Create `web` directory

3. Create `index.ejs`

``` ejs
<!DOCTYPE HTML>
<html>
    <head>
        <title><%= app.name %></title>
    </head>
    <body>
        Hello, world!
    </body>
</html>
```

4. Launch your app with `ess -lhttp://localhost:3000`

5. Open `localhost:3000` in your browser

Yes, that easy, no "*create an overly-complicated function component that has more boilerplate code that Java class fields that breaks whey try doing anything more complicated than updating a list*". Actually, having "*more boilerplate code than Java*" should be a feature, why [REDACTED] devs haven't thought about that?

If you don't like using plain html and would like to have your entire UI rendered with JavaScript, consider looking into [React](https://reactjs.org/) instead.

## Why not use actual frameworks?

Two words, *personal preference*. If you're used to editing plain `.html` files, using `ess` will give you the power of server-side rendering, which might save you a lot of time. But if you love React and React-like solutions, `ess` might not be for you.

## Other projects to check out
- [Prisma](https://www.prisma.io/)
- [EJS](https://ejs.co/)
- [SASS](https://sass-lang.com/)
