const hash = require("../../hash").get_hash_code;
const assert = require("assert");
const mongoose = require("mongoose");
const timestamps = require('mongoose-timestamp'); // TODO: consider using this for last update time data.
let projects_model, users_model;
let version_schema;
let is_initialize = false;

let init_projects_schema = async _ => {
    // Define version schema
    version_schema = mongoose.Schema({
        version: {
            type: String,
            required: true
        },
        prev_version: {
            type: String,
            required: true
        },
        is_beta: {
            type: Boolean,
            default: false
        },
        details: String,
        downloader: String,
        release_date: {
            type: Date,
            default: Date.now
        },
        known_issues: String,
        properties: [
            {
                // _id is automatically generated by mongodb
                type: {
                    type: String,
                    enum: ['Feature', 'Fix Bug', 'Change', 'Deprecated'],
                    default: 'Feature',
                    required: true
                },
                description: {
                    type: String,
                    required: true
                },
                tests_scope: {
                    type: String,
                    enum: ['None', 'Partial', 'Large', 'Full'],
                    default: 'Partial',
                    required: true
                },
                tests_details: String,
                known_issues: String
            }
        ]
    });

    // Define system schema
    let schema = mongoose.Schema({
        name: {
            type: String,
            required: true
        },
        git_repository: {
            type: String,
            required: false
        },
        versions: [
            version_schema
        ]
    });

    // Text search indexes
    /*schema.index({
        "versions.details": 'text',
        "versions.downloader": 'text',
        "versions.known_issues": 'text',
        "versions.properties.type": 'text',
        "versions.properties.description": 'text',
        "versions.properties.known_issues": 'text'
    }, {
        weights: {
            "versions.details": 1,
            "versions.downloader": 1,
            "versions.known_issues": 1,
            "versions.properties.type": 1,
            "versions.properties.description": 1,
            "versions.properties.known_issues": 1
        }
    });*/

    // Create systems model
    projects_model = mongoose.model('projects', schema);

    projects_model.find({}).exec(async (err, res) => {
        if (err) {}
        if (!res.length) {
            let new_unnamed_project = new projects_model({
                name: "UNNAMED",
                versions: []
            });

            new_unnamed_project = await new_unnamed_project.save();
        }
    });

    // Make sure the text search indexes are ready
    projects_model.on('index', error => { if (error) console.log(error) });
};

let init_users_schema = _ => {
    // Define users schema
    let schema = mongoose.Schema({
        // _id is automatically generated by mongodb
        username: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: Number,
            // 4 -> Admin    -> Full access + Admin panel access.
            // 3 -> Manager  -> Create / Delete / Modify versions/properties access.
            // 2 -> User     -> Watch & Comment for issues in versions.
            // 1 -> Guest    -> Watch access.
            // 0 -> Banned   -> No access at all.
            //enum: ['Admin', 'Manager', 'User', 'Guest', 'Banned'],
            default: 1,
            required: true
        },
        register_date: {
            type: Date,
            default: Date.now
        },
        personal_settings: {
            versions_in_page: {
                type: Number,
                default: 2
            },
            properties_in_page: {
                type: Number,
                default: 3
            }
        }
    });

    // Text search indexes
    schema.index({
        username: 'text',
        role: 'text',
    }, {
        weights: {
            username: 1,
            role: 10,
        }
    });

    // Create versions model
    users_model = mongoose.model('users', schema);

    // If there are no users in db, create an admin user. username = "admin" & password = "admin".
    users_model.find({}).exec((err, data) => {
        if (!data.length) {
            let password = hash("admin");
            let username = "admin";
            let role = 4;
            let new_user = new users_model({
                username: username,
                password: password,
                role: role
            });
            new_user.save((err) => {});
        }
    });

    // Make sure the text search indexes are ready
    users_model.on('index', error => { if (error) console.log(error) });
};

let initDB = callback => {
    assert.ok(!is_initialize, "A try to initialize an initialized DB detected.");
    let db_new = mongoose.connect('mongodb://localhost/versions_track', {
    //let db_new = mongoose.connect('mongodb://localhost/test_versions_track', {
        useNewUrlParser: true,
        useCreateIndex: true,
        useUnifiedTopology: true
    });

    console.log("Db connected successfully");

    init_projects_schema();
    init_users_schema();

    // FOR PREVIOUS `VersionsTrack`  VERSIONS UPGRADE:
    // If there is a `versions` model, create a new project named "UNNAMED", copy all of the versions to there, and remove `versions` model.

    mongoose.connection.on('open', async function() {
        mongoose.connection.db.listCollections().toArray(async function (err, names) {
            if (err) {
                console.log(err);
            } else {
                for (let i = 0; i < names.length; i++) {
                    if (names[i].name === "versions") {
                        console.log("Old 'VersionsTrack' version upgrade detected.");
                        let current_versions_model = mongoose.model('versions', version_schema);
                        let current_versions = await current_versions_model.find({}).exec();
                        let is_unnamed_exists = await projects_model.find({name: "UNNAMED"});
                        if (is_unnamed_exists.length === 0) {
                            let new_unnamed_project = new projects_model({
                                name: "UNNAMED",
                                versions: current_versions
                            });

                            new_unnamed_project = await new_unnamed_project.save();
                        } else {
                            let filter = {name: "UNNAMED"};
                            let update = {
                                $push:
                                    {
                                        versions: current_versions
                                    }
                            };
                            let new_project = await projects_model.findOneAndUpdate(filter, update, {
                                new: true // Return the new object after the update is applied
                            });
                        }

                        // Clear 'versions' model!
                        let res = await current_versions_model.remove({}).exec();
                        console.log(res);
                    }
                }
            }
        });
    });

    is_initialize = true;
    callback();
};

let db_use_pre_conditions = _ => {
    assert.ok(is_initialize, "Db has not been initialized. Please called init first.");
};

let getProjectsDBModel = _ => {
    db_use_pre_conditions();
    return projects_model;
};

let getVersionsDBModel = async system_name => {
    db_use_pre_conditions();
    if (system_name === undefined) system_name = "UNNAMED";
    let res = await projects_model.find({name: system_name});
    if (res.length === 0) throw new Error("System not found.");
    return res[0];
};

let getUsersDBModel = _ => {
    db_use_pre_conditions();
    return users_model;
};

module.exports = {
    getDB: _ => {
        return {
            projects_model: getProjectsDBModel,
            versions_model: getVersionsDBModel,
            users_model: getUsersDBModel
        }
    },
    initDB
};