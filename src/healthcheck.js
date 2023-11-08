import express from "express";

const startHealthCheckBeacon = () => {

    const app = express();
    
    app.get("/", function (req, res) {
        res.send("Server is up!");
    });
    
    app.listen(3000);
}

export { startHealthCheckBeacon };
