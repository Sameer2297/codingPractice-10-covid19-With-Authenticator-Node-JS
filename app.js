const express = require("express");
const app = express();
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db;

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(5000, () => {
      console.log("Server started running!!!");
    });
  } catch (err) {
    console.log(`DB Error: ${err.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

convertStateTable = (stateObj) => {
  return {
    stateId: stateObj.state_id,
    stateName: stateObj.state_name,
    population: stateObj.population,
  };
};

convertDistrictTable = (districtObj) => {
  return {
    districtId: districtObj.district_id,
    districtName: districtObj.district_name,
    stateId: districtObj.state_id,
    cases: districtObj.cases,
    cured: districtObj.cured,
    active: districtObj.active,
    deaths: districtObj.deaths,
  };
};

const tokenAuthenticator = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let accessToken;
  if (authHeader !== undefined) {
      accessToken = authHeader.split(" ")[1];
  }
  if (accessToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(accessToken, "My_token", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//Login User API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserPwdFromDB = `SELECT * FROM user WHERE username = '${username}';`;
  const userDetails = await db.get(getUserPwdFromDB);
  //console.log(userDetails);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPwdMatched = await bcrypt.compare(password, userDetails.password);
    if (isPwdMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "My_token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Get states API
app.get("/states/", tokenAuthenticator, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`;
  const stateDetails = await db.all(getStatesQuery);
  response.send(stateDetails.map((each) => convertStateTable(each)));
});

//Get state API
app.get("/states/:stateId/", tokenAuthenticator, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const stateDetails = await db.get(getStateQuery);
  response.send(convertStateTable(stateDetails));
});

//Post district API
app.post("/districts/", tokenAuthenticator, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const insertQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(insertQuery);
  response.send("District Successfully Added");
});

//Get district API
app.get("/districts/:districtId/",tokenAuthenticator,async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const districtDetails = await db.get(getDistrictQuery);
    response.send(convertDistrictTable(districtDetails));
});

//Delete district API
app.delete("/districts/:districtId/",tokenAuthenticator,async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.exec(deleteDistrictQuery);
    response.send("District Removed");
});

//Update district API
app.put("/districts/:districtId/",tokenAuthenticator,async (request, response) => {
    const {districtName,stateId,cases,cured,active,deaths,} = request.body;
    const updateQuery = `UPDATE district SET district_name = '${districtName}', state_id = ${stateId}, cases = ${cases}, cured = ${cured}, active = ${active}, deaths = ${deaths};`;
    await db.exec(updateQuery);
    response.send("District Details Updated");
});

//Get state stats API
app.get("/states/:stateId/stats/",tokenAuthenticator, async(request,response) => {
    const {stateId} = request.params;
    const stateStatsQuery = `SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths FROM district WHERE state_id = ${stateId};`;
    const statsResult = await db.get(stateStatsQuery);
    response.send(statsResult);
});

module.exports = app;