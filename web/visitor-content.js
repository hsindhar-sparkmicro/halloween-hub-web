// Original stories for this app; no third-party story text or characters.
export const stories=[
 {title:'The Ghost Who Lost His Boo',background:1,start:'start',pages:{
  start:{text:'A tiny ghost peeks out from a hollow tree. “My boo has vanished!” he whispers. A sleepy owl points to two paths: one rings with little bells, the other smells of toasted pumpkin seeds.',choices:[['Follow the bells','bells'],['Follow the pumpkin scent','pumpkin']]},
  bells:{text:'The bells belong to fireflies practising a parade tune. The ghost tries to join in, but only a squeak comes out. “Perhaps your boo needs an audience,” says the smallest firefly.',choices:[['Invite the fireflies','ending'],['Ask the owl to help','owl']]},
  pumpkin:{text:'In a clearing, three jack-o’-lanterns are laughing at their own silly shadows. They invite the ghost to make the smallest sound he can. His little squeak makes them giggle.',choices:[['Try a bigger boo','ending'],['Make an owl sound','owl']]},
  owl:{text:'The owl teaches a slow breath: in like smelling cocoa, out like cooling it. The ghost’s squeak stretches into a soft “boooo.” Everyone gathers to hear one more try.',choices:[['Give it a try','ending']]},
  ending:{text:'“BOO!” The ghost’s voice returns, followed by a shower of delighted giggles. He had not lost it after all—he just needed a little courage and some kind listeners. He gives you a glowing firefly badge.',choices:[]}
 }},
 {title:'The Missing Pumpkin Lantern',background:2,start:'start',pages:{
  start:{text:'The autumn village is ready for its candy parade, but the leading lantern has rolled away. You find a golden leaf beside a muddy wheel mark. Where will you look first?',choices:[['Search the pumpkin patch','patch'],['Follow the wheel mark','cart']]},
  patch:{text:'A scarecrow has seen a small orange light bobbing toward the orchard. He gives you a ribbon that sparkles whenever the missing lantern is nearby.',choices:[['Visit the orchard','orchard'],['Check the candy cart','cart']]},
  cart:{text:'The candy cart is full of wrapped treats and one enormous blanket. Under it, a hedgehog is warming his paws beside a glowing pumpkin. “I thought it was a travelling fireplace!”',choices:[['Invite him to the parade','ending'],['Find him a cosy nest','orchard']]},
  orchard:{text:'You gather soft leaves for the hedgehog and see the lantern shining beneath the candy cart. Its grin has a tiny leaf stuck between the teeth. The ribbon twinkles like a string of stars.',choices:[['Bring everyone back','ending']]},
  ending:{text:'The lantern leads the parade, the hedgehog rides in a cosy basket, and the scarecrow waves his ribbon. The whole village cheers for its newest lantern detective. Your reward is a golden pumpkin badge.',choices:[]}
 }},
 {title:'The Midnight Candy Express',background:7,start:'start',pages:{
  start:{text:'A silver train arrives at a quiet station. Its ghost conductor has mixed up two parcels: moon-shaped biscuits for the bats and pumpkin sweets for the village. The labels have drifted away!',choices:[['Ask the bats','bats'],['Inspect the parcels','parcels']]},
  bats:{text:'The bats explain that their biscuits make a gentle clink when shaken. The village sweets make a soft rustle. “Listen carefully,” they chirp. “We promise not to nibble the evidence.”',choices:[['Listen to the parcels','parcels']]},
  parcels:{text:'One parcel clinks like tiny moons. The other rustles like autumn leaves. The conductor offers you a choice of the moonlit cave or the village square as the first stop.',choices:[['Take the clinking box to the cave','ending'],['Take the rustling box to the village','village']]},
  village:{text:'Children in friendly monster costumes welcome the rustling box. They draw a bright new label for the bats’ parcel and wave as the train sets off for its final stop.',choices:[['Visit the bat cave','ending']]},
  ending:{text:'Both parcels reach their homes. The bats flutter a thank-you dance, and the conductor stamps your ticket with a silver star. The Midnight Candy Express departs with one happy new helper: you.',choices:[]}
 }}
];
export const riddles=[
 {question:'I have wings, sleep upside down, and flutter through the night. Who am I?',answer:'Bat',choices:['Bat','Pumpkin','Ghost']},
 {question:'I start in a patch, wear an orange coat, and smile when a lantern lights me. Who am I?',answer:'Pumpkin',choices:['Ghost','Pumpkin','Bat']},
 {question:'I float without feet and practise saying “boo.” Who am I?',answer:'Ghost',choices:['Pumpkin','Bat','Ghost']}
];
