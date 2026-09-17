/**
 * Données de démo : `npm run seed` (ajoute si vide) ou `npm run seed -- --reset` (repart de zéro).
 * Les dates sont relatives à aujourd'hui pour que la démo reste vivante.
 */
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CreateHackathonInput, HackathonStatus } from '@hackametz/shared';
import { createHackathonInputSchema } from '@hackametz/shared';
import { strToU8, zipSync } from 'fflate';
import { env, paths } from '../config/env';
import { createContext } from '../context';
import { createEvaluation } from '../models/evaluation.model';
import { createFeedback } from '../models/feedback.model';
import { createRegistration } from '../models/registration.model';
import { createQuestion } from '../models/question.model';
import { createUser } from '../models/user.model';
import { createVote } from '../models/vote.model';

const reset = process.argv.includes('--reset');
/** `--empty` : on vide tout et on s'arrête là — pas de données de démonstration. */
const empty = process.argv.includes('--empty');

const ctx = createContext({
  dataDir: paths.dataDir,
  storageDir: paths.storageDir,
  adminKey: env.ADMIN_KEY,
  pseudoPolicy: env.PSEUDO_POLICY,
});

const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number, hour = 9) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

interface SeedHackathon {
  input: CreateHackathonInput;
  status: HackathonStatus;
}

const hackathons: SeedHackathon[] = [
  {
    status: 'finished',
    input: {
      title: "IA pour l'éducation",
      theme: 'Rendre l’apprentissage plus accessible grâce à l’IA générative',
      description:
        'Premier hackathon HackaMetz. Objectif : un prototype utilisable par un élève ou un enseignant en moins de 5 minutes de prise en main.',
      rules:
        'Code original uniquement. Les APIs externes sont autorisées, les clés restent hors du dépôt.',
      coverColor: '#7C3AED',
      tags: ['ia', 'éducation', 'llm'],
      format: 'hybrid',
      location: 'Campus + Discord',
      dates: {
        startsAt: at(-60),
        submissionDeadlineAt: at(-58, 18),
        endsAt: at(-58, 20),
        resultsAt: at(-55),
      },
      team: { enabled: true, minSize: 1, maxSize: 4 },
      criteria: [
        {
          label: 'Impact pédagogique',
          description: 'Le projet aide-t-il vraiment à apprendre ?',
          weight: 2,
        },
        { label: 'Qualité technique', weight: 1 },
        { label: 'Démo', description: 'Ça marche en live ?', weight: 1 },
      ],
      prizes: [
        { rank: 1, label: 'Coup de cœur du jury' },
        { rank: 2, label: 'Prix technique' },
      ],
      resources: [{ label: 'Docs API Claude', url: 'https://docs.anthropic.com' }],
    },
  },
  {
    status: 'running',
    input: {
      title: 'Ville durable',
      theme: 'Des outils numériques pour une ville plus sobre : mobilité, énergie, déchets',
      description:
        'Deuxième édition. Un jeu de données ouvert (mobilité, consommation énergétique) est fourni ; à vous de trouver l’angle.',
      rules:
        'Équipes de 2 à 5. Dépôt possible plusieurs fois jusqu’à la deadline, seule la dernière version compte.',
      coverColor: '#0F766E',
      tags: ['écologie', 'open-data', 'ville'],
      format: 'onsite',
      location: 'Tiers-lieu La Fabrique — salle B',
      dates: {
        startsAt: at(-1),
        submissionDeadlineAt: at(2, 18),
        endsAt: at(2, 21),
        resultsAt: at(4),
      },
      milestones: [
        { label: 'Kickoff', at: at(-1) },
        { label: 'Checkpoint mentors', at: at(1, 14) },
        { label: 'Pitchs', at: at(2, 19) },
      ],
      team: { enabled: true, minSize: 2, maxSize: 5 },
      submission: { maxSizeMb: 80, allowResubmit: true, allowLate: false },
      criteria: [
        { label: 'Utilité pour les habitants', weight: 2 },
        { label: 'Usage des données', weight: 1.5 },
        { label: 'Faisabilité', weight: 1 },
      ],
      prizes: [
        {
          rank: 1,
          label: 'Grand prix Ville durable',
          description: 'Accompagnement par la métropole',
        },
      ],
      resources: [{ label: 'Jeu de données mobilité', url: 'https://www.data.gouv.fr' }],
    },
  },
  {
    status: 'published',
    input: {
      title: 'Santé & bien-être',
      theme: 'Prévention, suivi et accompagnement : la tech au service de la santé du quotidien',
      description:
        'Inscriptions ouvertes. Thème large, pensé pour accueillir des profils non techniques.',
      coverColor: '#DC2626',
      tags: ['santé', 'mobile'],
      format: 'online',
      dates: {
        registrationOpensAt: at(-3),
        startsAt: at(21),
        submissionDeadlineAt: at(23, 12),
        endsAt: at(23, 18),
      },
      team: { enabled: false },
      maxParticipants: 40,
      criteria: [
        { label: 'Pertinence', weight: 1 },
        { label: 'Expérience utilisateur', weight: 1 },
      ],
    },
  },
  {
    status: 'draft',
    input: {
      title: 'Jeu vidéo en 48h',
      theme: 'Un jeu jouable en 48 heures sur un thème révélé au kickoff',
      coverColor: '#EA580C',
      tags: ['jeu', 'gamejam'],
      dates: { startsAt: at(60), submissionDeadlineAt: at(62), endsAt: at(62, 12) },
      team: { enabled: true, minSize: 1, maxSize: 3 },
    },
  },
];

const users = [
  { pseudo: 'simon', role: 'admin' as const },
  { pseudo: 'alice', role: 'participant' as const },
  { pseudo: 'bob', role: 'participant' as const },
  { pseudo: 'chloe', role: 'participant' as const },
  { pseudo: 'marie_jury', role: 'jury' as const },
];

interface SeedProject {
  hackathonCode: string;
  pseudo: string;
  title: string;
  pitch: string;
  techStack: string[];
  files: Record<string, string>;
}

const projects: SeedProject[] = [
  {
    hackathonCode: '001',
    pseudo: 'alice',
    title: 'Tuteur IA',
    pitch: 'Un tuteur qui reformule un cours en trois niveaux de difficulté et pose des questions.',
    techStack: ['Python', 'FastAPI', 'Claude API'],
    files: {
      'README.md': [
        '# Tuteur IA',
        '',
        'Reformule un cours en 3 niveaux et génère un quiz.',
        '',
        '## Lancer',
        '',
        '```',
        'pip install -r requirements.txt',
        'uvicorn app:app',
        '```',
      ].join('\n'),
      'app.py': [
        'from fastapi import FastAPI',
        '',
        'app = FastAPI()',
        '',
        '',
        '@app.get("/health")',
        'def health():',
        '    return {"ok": True}',
      ].join('\n'),
      'requirements.txt': ['fastapi', 'uvicorn', 'anthropic'].join('\n'),
      'src/prompts.py': 'LEVELS = ["débutant", "intermédiaire", "avancé"]',
    },
  },
  {
    hackathonCode: '001',
    pseudo: 'bob',
    title: 'QuizFlash',
    pitch: 'Des flashcards générées depuis un PDF de cours, révisables sur téléphone.',
    techStack: ['TypeScript', 'React', 'Vite'],
    files: {
      'README.md': ['# QuizFlash', '', 'Flashcards générées depuis un PDF.'].join('\n'),
      'package.json': '{ "name": "quizflash", "private": true, "scripts": { "dev": "vite" } }',
      'src/main.tsx': 'console.log("QuizFlash");',
      'src/components/Card.tsx': ['export function Card() {', '  return null;', '}'].join('\n'),
      'index.html': '<!doctype html><title>QuizFlash</title>',
    },
  },
  {
    hackathonCode: '002',
    pseudo: 'alice',
    title: 'Métro léger',
    pitch: 'Visualise les trajets domicile-travail du jeu de données et suggère des lignes de bus.',
    techStack: ['Python', 'Pandas', 'Leaflet'],
    files: {
      'README.md': ['# Métro léger', '', 'Analyse des trajets et propositions de lignes.'].join(
        '\n',
      ),
      'notebook.py': [
        'import pandas as pd',
        '',
        'df = pd.read_csv("data/trajets.csv")',
        'print(df.head())',
      ].join('\n'),
      'web/index.html': '<!doctype html><div id="map"></div>',
      'web/map.js': 'const map = L.map("map").setView([49.1193, 6.1757], 13);',
    },
  },
];

async function seedRegistrations() {
  const hackathons = await ctx.repos.hackathons.all();
  const users = await ctx.repos.users.all();
  const plan: Record<string, string[]> = {
    '001': ['alice', 'bob', 'chloe'],
    '002': ['alice', 'bob'],
    '003': ['chloe'],
  };
  let count = 0;
  for (const [code, pseudos] of Object.entries(plan)) {
    const hackathon = hackathons.find((h) => h.code === code)!;
    for (const pseudo of pseudos) {
      const user = users.find((u) => u.pseudo === pseudo)!;
      await ctx.repos.registrations.insert(createRegistration(hackathon.id, user.id));
      count += 1;
    }
  }
  console.log(`${count} inscriptions créées`);
}

/** Ville durable se joue en équipe : alice et bob forment « Les Mirabelles » avant de déposer. */
async function seedTeamsAndAnnouncements() {
  const hackathons = await ctx.repos.hackathons.all();
  const users = await ctx.repos.users.all();
  const ville = hackathons.find((h) => h.code === '002')!;
  const alice = users.find((u) => u.pseudo === 'alice')!;
  const bob = users.find((u) => u.pseudo === 'bob')!;
  const team = await ctx.services.teams.create(ville, alice, 'Les Mirabelles');
  await ctx.services.teams.join(ville, bob, team.inviteCode);
  console.log(`équipe « ${team.name} » créée (code ${team.inviteCode}) : alice, bob`);

  await ctx.services.announcements.create(ville, {
    title: 'Bienvenue à Ville durable !',
    content:
      'Le jeu de données est dans l’onglet Ressources. Les mentors passent à 14 h demain. Pizza à 20 h ce soir, salle B.',
    pinned: true,
  });
  await ctx.services.announcements.create(ville, {
    title: 'Rappel : deadline à 18 h',
    content: 'Seule la dernière version déposée compte. Pensez au README !',
    pinned: false,
  });
  console.log('2 annonces publiées sur 002');
}

async function seedProjects() {
  const hackathons = await ctx.repos.hackathons.all();
  const users = await ctx.repos.users.all();
  const tempDir = await ctx.storage.tempDir();
  for (const p of projects) {
    const hackathon = hackathons.find((h) => h.code === p.hackathonCode)!;
    const user = users.find((u) => u.pseudo === p.pseudo)!;
    const entries = Object.fromEntries(
      Object.entries(p.files).map(([path, content]) => [`${p.title}/${path}`, strToU8(content)]),
    );
    const zipPath = join(tempDir, `seed-${p.hackathonCode}-${p.pseudo}.zip`);
    const bytes = zipSync(entries);
    await writeFile(zipPath, bytes);
    const submission = await ctx.services.submissions.submit({
      hackathon,
      user,
      force: true,
      meta: {
        title: p.title,
        pitch: p.pitch,
        description: '',
        techStack: p.techStack,
        repoUrl: null,
        demoUrl: null,
        videoUrl: null,
        consentPublish: true,
        archiveDiscord: false,
      },
      archive: { path: zipPath, size: bytes.byteLength, originalName: `${p.title}.zip` },
    });
    console.log(
      `     projet ${String(submission.number).padStart(2, '0')} « ${p.title} » par ${submission.ownerPseudo} → ${hackathon.code}`,
    );
  }
}

/** Le hackathon 001 est terminé : marie_jury et simon l'ont noté, le podium est publié. */
async function seedEvaluations() {
  const hackathon = (await ctx.repos.hackathons.all()).find((h) => h.code === '001')!;
  const users = await ctx.repos.users.all();
  const jurors = ['marie_jury', 'simon'].map((p) => users.find((u) => u.pseudo === p)!);
  await ctx.repos.hackathons.update(hackathon.id, { juryIds: jurors.map((j) => j.id) });
  const submissions = await ctx.repos.submissions.filter((s) => s.hackathonId === hackathon.id);
  const [impact, technique, demo] = hackathon.criteria;
  const grades: Record<string, [number, number, number][]> = {
    'Tuteur IA': [
      [9, 8, 9],
      [8, 9, 7],
    ],
    QuizFlash: [
      [7, 9, 8],
      [7, 7, 9],
    ],
  };
  const comments: Record<string, string[]> = {
    'Tuteur IA': [
      'Très bon niveau pédagogique, démo fluide.',
      'Prompting soigné, à industrialiser.',
    ],
    QuizFlash: ['Idée simple et efficace.', 'Belle UI mobile, manque un export.'],
  };
  let count = 0;
  for (const submission of submissions) {
    for (const [i, juror] of jurors.entries()) {
      const [a, b, c] = grades[submission.title]![i]!;
      await ctx.repos.evaluations.insert(
        createEvaluation({
          hackathonId: hackathon.id,
          submissionId: submission.id,
          juryId: juror.id,
          juryPseudo: juror.pseudo,
          scores: { [impact!.id]: a, [technique!.id]: b, [demo!.id]: c },
          comment: comments[submission.title]![i]!,
        }),
      );
    }
    count += jurors.length;
  }
  console.log(`${count} notes du jury sur 001 (jury : ${jurors.map((j) => j.pseudo).join(', ')})`);
}

/** Coup de cœur du public sur 001 : chloe et bob votent pour « Tuteur IA », alice pour « QuizFlash ». */
async function seedVotes() {
  const hackathon = (await ctx.repos.hackathons.all()).find((h) => h.code === '001')!;
  const users = await ctx.repos.users.all();
  const submissions = await ctx.repos.submissions.filter((s) => s.hackathonId === hackathon.id);
  const byTitle = (title: string) => submissions.find((s) => s.title === title)!;
  const plan: [string, string][] = [
    ['chloe', 'Tuteur IA'],
    ['bob', 'Tuteur IA'],
    ['alice', 'QuizFlash'],
  ];
  for (const [pseudo, title] of plan) {
    const user = users.find((u) => u.pseudo === pseudo)!;
    await ctx.repos.votes.insert(createVote(hackathon.id, byTitle(title).id, user.id));
  }
  console.log(`${plan.length} votes du public sur 001`);
}

/** Questions à l'organisateur : deux répondues sur 001, deux en attente sur 002. */
async function seedQuestions() {
  const all = await ctx.repos.hackathons.all();
  const users = await ctx.repos.users.all();
  const byPseudo = (pseudo: string) => users.find((u) => u.pseudo === pseudo)!;
  const h001 = all.find((h) => h.code === '001')!;
  const h002 = all.find((h) => h.code === '002')!;
  const plan: {
    hackathon: typeof h001;
    author: string;
    content: string;
    answer?: string;
    upvotes: string[];
  }[] = [
    {
      hackathon: h001,
      author: 'bob',
      content:
        'Peut-on utiliser une API d’IA externe (OpenAI, Mistral…) ou faut-il du 100 % local ?',
      answer:
        'Les API externes sont autorisées tant que la clé n’est pas dans le dépôt. Pense au `.env`, il est exclu automatiquement à l’archivage.',
      upvotes: ['alice', 'chloe'],
    },
    {
      hackathon: h001,
      author: 'chloe',
      content: 'Le pitch final dure combien de temps ?',
      answer: '4 minutes + 2 minutes de questions du jury.',
      upvotes: [],
    },
    {
      hackathon: h002,
      author: 'alice',
      content:
        'Y a-t-il des données ouvertes de la ville fournies, ou on se débrouille avec data.gouv ?',
      upvotes: ['bob', 'chloe'],
    },
    {
      hackathon: h002,
      author: 'bob',
      content: 'Est-ce qu’une équipe peut déposer plusieurs projets ?',
      upvotes: ['alice'],
    },
  ];
  for (const q of plan) {
    const question = createQuestion(q.hackathon.id, byPseudo(q.author), q.content);
    question.upvoterIds = q.upvotes.map((p) => byPseudo(p).id);
    if (q.answer) question.answer = { content: q.answer, byPseudo: 'simon', at: at(-20, 18) };
    await ctx.repos.questions.insert(question);
  }
  console.log(`${plan.length} questions (2 répondues sur 001, 2 en attente sur 002)`);
}

/** Retours des participants sur l'édition terminée. */
async function seedFeedback() {
  const hackathon = (await ctx.repos.hackathons.all()).find((h) => h.code === '001')!;
  const users = await ctx.repos.users.all();
  const plan: [string, number, string, string, boolean][] = [
    [
      'alice',
      5,
      'L’ambiance et les mentors disponibles toute la nuit.',
      'Plus de prises électriques !',
      true,
    ],
    ['bob', 4, 'Le thème, très concret.', 'Un peu plus de temps pour le pitch.', true],
    [
      'chloe',
      4,
      'Les équipes mélangées, on apprend beaucoup.',
      'Le wifi a lâché le samedi soir.',
      true,
    ],
  ];
  for (const [pseudo, rating, liked, improve, wouldReturn] of plan) {
    const user = users.find((u) => u.pseudo === pseudo)!;
    await ctx.repos.feedback.insert(
      createFeedback(hackathon.id, user.id, { rating, liked, improve, wouldReturn }),
    );
  }
  console.log(`${plan.length} retours sur 001`);
}

/** Un tour clôturé (qui a donné « Santé & bien-être ») et un tour ouvert au vote. */
async function seedProposals() {
  const users = await ctx.repos.users.all();
  const byPseudo = (p: string) => users.find((u) => u.pseudo === p)!;
  const sante = (await ctx.repos.hackathons.all()).find((h) => h.code === '003')!;

  const past = await ctx.services.proposals.create({
    title: 'Thème de l’automne 2026',
    description: 'Trois pistes pour l’édition d’octobre. Le vote a duré une semaine.',
    proposals: [
      {
        title: 'Santé & bien-être',
        theme: 'Prévention, suivi et accompagnement au quotidien',
        description: '',
        tags: ['santé', 'mobile'],
        coverColor: '#DC2626',
      },
      {
        title: 'Patrimoine augmenté',
        theme: 'Faire parler les monuments de Metz avec la réalité augmentée',
        description: '',
        tags: ['culture', 'AR'],
        coverColor: '#7C3AED',
      },
      {
        title: 'Commerce de proximité',
        theme: 'Des outils simples pour les commerçants du centre-ville',
        description: '',
        tags: ['commerce'],
        coverColor: '#0F766E',
      },
    ],
  });
  await ctx.services.proposals.open(past.id);
  const [pSante, pPatrimoine] = past.proposals;
  for (const pseudo of ['alice', 'bob', 'chloe'])
    await ctx.services.proposals.vote(past.id, byPseudo(pseudo), pSante!.id);
  await ctx.services.proposals.vote(past.id, byPseudo('marie_jury'), pPatrimoine!.id);
  await ctx.services.proposals.close(past.id);
  await ctx.services.proposals.linkHackathon(past.id, sante.id);

  const current = await ctx.services.proposals.create({
    title: 'Thème de l’hiver 2026',
    description:
      'À vous de choisir le prochain thème. Le vote reste ouvert jusqu’au kickoff de décembre.',
    proposals: [
      {
        title: 'Nuit du code créatif',
        theme: 'Art génératif, musique et visuels en temps réel',
        description: 'Un hackathon pour les créatifs autant que pour les développeurs.',
        tags: ['créatif', 'audio', 'webgl'],
        coverColor: '#DB2777',
      },
      {
        title: 'Data pour la Moselle',
        theme: 'Explorer les données ouvertes du département',
        description:
          'Cartes, tableaux de bord, alertes : donner du sens aux jeux de données publics.',
        tags: ['open-data', 'carto'],
        coverColor: '#2563EB',
      },
      {
        title: 'Low-tech numérique',
        theme: 'Des applications qui tournent sur du vieux matériel',
        description: 'Sobriété, accessibilité, hors-ligne : coder léger.',
        tags: ['sobriété', 'accessibilité'],
        coverColor: '#16A34A',
      },
    ],
  });
  await ctx.services.proposals.open(current.id);
  const [creatif, data] = current.proposals;
  await ctx.services.proposals.vote(current.id, byPseudo('alice'), data!.id);
  await ctx.services.proposals.vote(current.id, byPseudo('bob'), creatif!.id);
  console.log('2 tours de propositions (1 clôturé → 003, 1 ouvert au vote)');
}

async function main() {
  if (reset) {
    await ctx.repos.feedback.clear();
    await ctx.repos.questions.clear();
    await ctx.repos.proposalVotes.clear();
    await ctx.repos.proposalRounds.clear();
    await ctx.repos.votes.clear();
    await ctx.repos.evaluations.clear();
    await ctx.repos.submissions.clear();
    await ctx.repos.registrations.clear();
    await ctx.repos.hackathons.clear();
    await ctx.repos.users.clear();
    console.log('Collections vidées.');
    if (empty) {
      // Les dossiers de projets doivent partir aussi : sinon la prochaine édition #001
      // réutiliserait le dossier d'une ancienne et mélangerait les dépôts.
      await rm(join(paths.storageDir, 'hackathons'), { recursive: true, force: true });
      console.log('Dossiers de projets supprimés.');
      console.log('Base vide : crée ton édition depuis /admin.');
      return;
    }
  } else if ((await ctx.repos.hackathons.count()) > 0) {
    console.log(
      'Des hackathons existent déjà — rien à faire. Utilise --reset pour repartir de zéro.',
    );
    return;
  }

  for (const u of users) {
    await ctx.repos.users.insert(createUser(u.pseudo, u.role));
  }
  console.log(`${users.length} utilisateurs créés : ${users.map((u) => u.pseudo).join(', ')}`);

  for (const { input, status } of hackathons) {
    const data = createHackathonInputSchema.parse(input);
    const created = await ctx.services.hackathons.create(data);
    const hackathon = await ctx.repos.hackathons.update(created.id, { status });
    await ctx.storage.writeManifest(hackathon);
    console.log(
      `${hackathon.code}  ${hackathon.title.padEnd(24)} ${status.padEnd(10)} → ${hackathon.storagePath}`,
    );
  }

  await seedRegistrations();
  await seedTeamsAndAnnouncements();
  await seedProjects();
  await seedEvaluations();
  await seedVotes();
  await seedQuestions();
  await seedFeedback();
  await seedProposals();
  await ctx.services.kb.export({ commit: false });

  console.log(`\nDonnées : ${paths.dataDir}\nStockage : ${paths.storageDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
