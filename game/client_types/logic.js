/**
* # Logic code for Meritocracy Game
* Copyright(c) 2017 Stefano Balietti
* MIT Licensed
*
* http://www.nodegame.org
* ---
*/

const path = require('path');
const fs   = require('fs-extra');

const ngc = require('nodegame-client');
const J = ngc.JSUS;


module.exports = function(treatmentName, settings, stager, setup, gameRoom) {

    const channel = gameRoom.channel;
    const node = gameRoom.node;
    const groupSize = gameRoom.game.waitroom.GROUP_SIZE;
    const memory = node.game.memory;

    stager.setDefaultProperty('minPlayers', [ groupSize ]);

    // Event handler registered in the init function are always valid.
    stager.setOnInit(function() {



    });

    // Extends Stages and Steps where needed.

    stager.extendStep('bid', {
        init: function() {
            // Counter for total contributions in this round.
            this.totalContr = 0;
            // Keep tracks of results sent to players in case of disconnections.
            this.contribs = {};
        },
        cb: function() {
            // Keep count of total contributions as they arrive.
            node.on.data('done', function(msg) {
                // console.log(msg);
                this.contribs[msg.from] = msg.data.contribution;
                this.totalContr += msg.data.contribution;
            });
        }
    });

    stager.extendStep('results', {
        cb: function() {
            var previousStep, sortedContribs, total;

            // Get previous contributions
            previousStep = node.game.getPreviousStep();
            // Get all contribution in previous step.
            sortedContribs = memory.stage[previousStep]
            .selexec('contribution')
            .sort(sortContributions)
            .fetch();

            // Multiply contributions.
            total = this.totalContr * settings.GROUP_ACCOUNT_MULTIPLIER;

            // Save to db, and sends results to players.
            finalizeRound(total, this.contribs, sortedContribs);
            
            //console.log('****************************** FranČesko to zkouší... ******************************');
            //console.log(sortedContribs);
            //console.log(this.contribs);
            //console.log(total);
        }
    });

    stager.extendStep('end', {
        cb: function() {

            console.log('FINAL PAYOFF PER PLAYER');
            console.log('***********************');

            gameRoom.computeBonus({
                say: true,
                dump: true,
                print: true
            });

            // Dump all memory.
            memory.save('memory_all.json');
        }
    });

    // Helper functions.

    // Saves results and sends to clients.
    function finalizeRound(total, contribs, sortedContribs) {
        var i, contribObj;
        var pid, payoff, client, distribution;
        
        //console.log(contribs);
        //console.log(total);

        distribution = total / sortedContribs.length;
        // Save the results for each player, and notify him/her.
        for ( i=0 ; i < sortedContribs.length; i++) {
            contribObj = sortedContribs[i];
            pid = contribObj.player;

            payoff = node.game.settings.COINS - contribs[pid] + distribution; // Edited FrK: - contribObj.contribution;
            
            console.log('Player ' + pid + ':');
            console.log('Distrbution: ' + distribution);
            console.log('Contribution: ' + contribs[pid]);
            console.log('Savings: ' + (node.game.settings.COINS - contribs[pid]));
            console.log('Overall pay-off: ' + payoff);

            // Store payoff in registry, so that gameRoom.computeBonus
            // can access it.
            client = channel.registry.getClient(pid);
            client.win += payoff;

            if (settings.showBars) {
                node.say('results', pid, {
                    contribs: sortedContribs,
                    total: total,
                    payoff: payoff
                });
            }
            else {
                node.say('results', pid, {
                    total: total,
                    payoff: payoff
                });
            }
        }
    }

    // If two contributions are exactly the same, then they are randomly ordered.
    function sortContributions(c1, c2) {
        if (c1.contribution > c2.contribution) return -1;
        if (c1.contribution < c2.contribution) return 1;
        if (Math.random() <= 0.5) return -1;
        return 1;
    }

};
