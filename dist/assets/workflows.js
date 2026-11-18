import {mountChat} from './workflow-chat.js';
import {mountIntake} from './workflow-intake.js';
const chat=document.querySelector('[data-nortivo-chat]');
if(chat)mountChat(chat);
const intake=document.querySelector('[data-nortivo-intake]');
if(intake)mountIntake(intake,document.querySelector('[data-nortivo-intake-summary]'));
