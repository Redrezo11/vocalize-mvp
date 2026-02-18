// Reading mode text genres and topics — parallel to eflTopics.ts for listening mode
// No speaker counts, no audio formats. Instead: text genres + topic categories.
// 23 genres, 18 categories, ~294 topics

// --- Types ---

export type RegisterType = 'formal' | 'informal' | 'semi-formal' | 'neutral' | 'transactional' | 'varies';

export interface ReadingGenre {
  id: string;
  label: string;
  register: RegisterType;
  promptDescription: string;
  compatibleCategories?: string[];  // undefined = works with ALL categories
}

export interface ReadingTopicCategory {
  name: string;
  topics: string[];
}

// --- Reading Genres (23 total) ---

export const READING_GENRES: ReadingGenre[] = [
  // --- Everyday & Practical ---
  {
    id: 'email_personal',
    label: 'Personal Email',
    register: 'informal',
    promptDescription: 'A casual email between friends, family, or acquaintances. Includes personal news, plans, invitations, or catching up.',
    compatibleCategories: ['Daily Life & Social', 'Travel & Leisure', 'Family & Relationships'],
  },
  {
    id: 'email_formal',
    label: 'Formal Email',
    register: 'formal',
    promptDescription: 'A professional or official email — complaint, inquiry, application, or business correspondence. Clear structure with greeting, body, closing.',
    compatibleCategories: ['Work & Business', 'Education & Study', 'Money & Finance'],
  },
  {
    id: 'letter_formal',
    label: 'Formal Letter',
    register: 'formal',
    promptDescription: 'A formal letter of complaint, application, request, or official correspondence. Proper letter format with addresses, date, salutation.',
    compatibleCategories: ['Work & Business', 'Community & Services', 'Money & Finance'],
  },
  {
    id: 'notice_sign',
    label: 'Notice or Sign',
    register: 'neutral',
    promptDescription: 'A short public notice, sign, or information board — rules, warnings, opening hours, event announcements. Brief and factual.',
    compatibleCategories: ['Community & Services', 'Travel & Leisure', 'Sports & Fitness'],
  },
  {
    id: 'advertisement',
    label: 'Advertisement',
    register: 'transactional',
    promptDescription: 'A print or online advertisement for a product, service, event, or job vacancy. Persuasive language, key details (price, date, contact).',
    compatibleCategories: ['Shopping & Consumer', 'Work & Business', 'Travel & Leisure', 'Food & Cooking', 'Sports & Fitness'],
  },
  {
    id: 'instructions',
    label: 'Instructions / How-To',
    register: 'neutral',
    promptDescription: 'Step-by-step instructions or a how-to guide — recipes, assembly instructions, user guides, safety procedures. Sequential and clear.',
    compatibleCategories: ['Daily Life & Social', 'Technology & Digital Life', 'Food & Cooking', 'Sports & Fitness'],
  },
  {
    id: 'form_application',
    label: 'Form or Application',
    register: 'formal',
    promptDescription: 'A form, application, or survey with fields to complete — registration, membership, booking. Tests ability to extract specific information.',
    compatibleCategories: ['Community & Services', 'Education & Study', 'Work & Business', 'Money & Finance'],
  },

  // --- Informational & Media ---
  {
    id: 'article_newspaper',
    label: 'Newspaper Article',
    register: 'semi-formal',
    promptDescription: 'A newspaper or news website article reporting on a current event, local story, or human interest piece. Inverted pyramid structure, factual tone.',
    compatibleCategories: ['Current Events & Society', 'Community & Services', 'Science & Discovery', 'History & Heritage'],
  },
  {
    id: 'article_magazine',
    label: 'Magazine Article',
    register: 'semi-formal',
    promptDescription: 'A magazine feature article on lifestyle, culture, health, technology, or travel. More descriptive and engaging than news, with personal angles.',
    compatibleCategories: ['Health & Wellbeing', 'Travel & Leisure', 'Technology & Digital Life', 'Culture & Entertainment', 'Food & Cooking', 'Sports & Fitness', 'Science & Discovery', 'Arts & Creativity'],
  },
  {
    id: 'blog_post',
    label: 'Blog Post',
    register: 'informal',
    promptDescription: 'A personal or semi-professional blog post — opinions, experiences, recommendations, tips. Conversational tone, first-person perspective.',
    compatibleCategories: ['Daily Life & Social', 'Travel & Leisure', 'Culture & Entertainment', 'Health & Wellbeing', 'Food & Cooking', 'Sports & Fitness', 'Family & Relationships', 'Arts & Creativity'],
  },
  {
    id: 'review',
    label: 'Review',
    register: 'informal',
    promptDescription: 'A review of a product, restaurant, hotel, book, film, or service. Includes opinion, rating, pros/cons, recommendation.',
    compatibleCategories: ['Shopping & Consumer', 'Culture & Entertainment', 'Travel & Leisure', 'Food & Cooking', 'Sports & Fitness', 'Arts & Creativity'],
  },
  {
    id: 'brochure_leaflet',
    label: 'Brochure / Leaflet',
    register: 'neutral',
    promptDescription: 'An informational brochure or leaflet about a place, service, or organization — tourist information, health advice, school prospectus. Organized sections with key facts.',
    compatibleCategories: ['Travel & Leisure', 'Community & Services', 'Education & Study', 'Health & Wellbeing', 'Sports & Fitness', 'History & Heritage'],
  },
  {
    id: 'report',
    label: 'Report',
    register: 'formal',
    promptDescription: 'A short report presenting findings, data, or recommendations — survey results, incident report, progress update. Structured with headings and conclusions.',
    compatibleCategories: ['Work & Business', 'Education & Study', 'Current Events & Society', 'Science & Discovery', 'Money & Finance'],
  },

  // --- Narrative & Creative ---
  {
    id: 'story_short',
    label: 'Short Story',
    register: 'varies',
    promptDescription: 'A short fiction narrative with characters, setting, and plot. Tests understanding of sequence, character motivation, and theme.',
    compatibleCategories: ['Culture & Entertainment', 'Daily Life & Social', 'Family & Relationships', 'History & Heritage'],
  },
  {
    id: 'biography',
    label: 'Biography / Profile',
    register: 'semi-formal',
    promptDescription: 'A biographical text about a person — their life, achievements, challenges. Can be famous or everyday person. Chronological or thematic structure.',
    compatibleCategories: ['Culture & Entertainment', 'Current Events & Society', 'Sports & Fitness', 'Science & Discovery', 'History & Heritage', 'Arts & Creativity'],
  },
  {
    id: 'diary_journal',
    label: 'Diary / Journal Entry',
    register: 'informal',
    promptDescription: 'A personal diary or journal entry describing experiences, feelings, and reflections. First-person, dated, emotional and reflective tone.',
    compatibleCategories: ['Daily Life & Social', 'Travel & Leisure', 'Family & Relationships'],
  },

  // --- Academic & Educational ---
  {
    id: 'textbook_excerpt',
    label: 'Textbook Excerpt',
    register: 'formal',
    promptDescription: 'An excerpt from a textbook or educational material explaining a concept, process, or phenomenon. Informational, may include definitions and examples.',
    compatibleCategories: ['Technology & Digital Life', 'Environment & Nature', 'Current Events & Society', 'Science & Discovery', 'History & Heritage', 'Money & Finance'],
  },
  {
    id: 'essay_opinion',
    label: 'Opinion Essay',
    register: 'semi-formal',
    promptDescription: 'An argumentative or opinion essay presenting a viewpoint with supporting evidence. Introduction, body paragraphs, conclusion structure.',
    compatibleCategories: ['Current Events & Society', 'Environment & Nature', 'Education & Study', 'Sports & Fitness', 'Food & Cooking', 'Money & Finance', 'Family & Relationships'],
  },
  {
    id: 'encyclopedia_entry',
    label: 'Encyclopedia Entry',
    register: 'formal',
    promptDescription: 'A factual encyclopedia or reference entry about a topic — animal, place, historical event, invention. Objective, informational, structured.',
    compatibleCategories: ['Technology & Digital Life', 'Environment & Nature', 'Culture & Entertainment', 'Science & Discovery', 'History & Heritage', 'Arts & Creativity'],
  },
  {
    id: 'website_info',
    label: 'Website / FAQ Page',
    register: 'neutral',
    promptDescription: 'Content from an informational website or FAQ page — organization info, service details, frequently asked questions with answers. Scannable format.',
    compatibleCategories: ['Community & Services', 'Education & Study', 'Shopping & Consumer', 'Money & Finance', 'Sports & Fitness'],
  },

  // --- New Genres ---
  {
    id: 'social_media_post',
    label: 'Social Media Post / Thread',
    register: 'informal',
    promptDescription: 'A social media post, thread, or comment exchange — sharing opinions, experiences, or tips. Includes hashtags, casual language, short paragraphs. May include replies.',
    compatibleCategories: ['Daily Life & Social', 'Travel & Leisure', 'Food & Cooking', 'Sports & Fitness', 'Culture & Entertainment', 'Family & Relationships'],
  },
  {
    id: 'recipe_menu',
    label: 'Recipe or Menu',
    register: 'neutral',
    promptDescription: 'A recipe with ingredients and step-by-step cooking instructions, or a restaurant/cafe menu with descriptions and prices. Tests reading for specific detail.',
    compatibleCategories: ['Food & Cooking', 'Daily Life & Social', 'Travel & Leisure'],
  },
  {
    id: 'infographic_chart',
    label: 'Infographic / Chart Description',
    register: 'semi-formal',
    promptDescription: 'A text describing data from a chart, graph, or infographic. Includes trends, comparisons, and numerical information. Tests ability to understand data presented in words.',
    compatibleCategories: ['Science & Discovery', 'Money & Finance', 'Current Events & Society', 'Environment & Nature', 'Health & Wellbeing', 'Sports & Fitness'],
  },
];

// --- Topic Categories (18 categories, ~294 topics total) ---

export const READING_TOPIC_CATEGORIES: ReadingTopicCategory[] = [
  {
    name: 'Daily Life & Social',
    topics: [
      'Moving to a new apartment or neighborhood',
      'Planning a birthday party or celebration',
      'A typical day in the life of a student',
      'Organizing a community clean-up event',
      'A friendship that changed someone\'s life',
      'Dealing with a noisy neighbor',
      'Starting a new hobby or sport',
      'The first day at a new school or job',
      'Balancing studies and part-time work',
      'A surprising gift that meant a lot',
      'Morning routines that help you start the day right',
      'How to make a good first impression',
      'The challenges of keeping a daily schedule',
      'Sharing a flat with roommates for the first time',
      'How people spend their free time in different countries',
      'The art of making small talk with strangers',
    ],
  },
  {
    name: 'Travel & Leisure',
    topics: [
      'A backpacking trip through Southeast Asia',
      'Visiting a famous landmark for the first time',
      'A travel disaster that turned into an adventure',
      'Comparing city holidays and countryside holidays',
      'How budget airlines have changed travel',
      'A guide to visiting a local museum or gallery',
      'Planning a road trip with friends',
      'Staying in an unusual accommodation (treehouse, igloo)',
      'How to pack efficiently for a two-week trip',
      'A solo travel experience and lessons learned',
      'Eco-tourism and responsible travel practices',
      'How travel apps have changed the way we explore new places',
      'The pros and cons of all-inclusive package holidays',
      'A weekend getaway on a tight budget',
      'Volunteering abroad as a way to travel and learn',
      'Hidden gems and off-the-beaten-path destinations',
    ],
  },
  {
    name: 'Work & Business',
    topics: [
      'How to write a good CV or resume',
      'The benefits and challenges of remote work',
      'Starting a small business from home',
      'Preparing for a job interview',
      'Workplace diversity and inclusion',
      'How internships help career development',
      'The rise of freelancing and gig economy',
      'Dealing with work-life balance',
      'A successful entrepreneur\'s story',
      'How technology is changing the workplace',
      'Teamwork skills that employers value most',
      'Career change at any age — is it too late?',
      'The importance of networking for career growth',
      'How to handle difficult conversations at work',
      'What makes a good leader in the modern workplace',
      'Understanding your rights as an employee',
    ],
  },
  {
    name: 'Education & Study',
    topics: [
      'The advantages of studying abroad',
      'How to develop effective study habits',
      'Online learning vs traditional classroom learning',
      'The importance of lifelong learning',
      'A new school program that is making a difference',
      'How libraries are evolving in the digital age',
      'Study tips from top students',
      'The role of extracurricular activities in education',
      'Learning a second language — challenges and rewards',
      'The history and future of standardized testing',
      'Scholarships and financial aid for students',
      'How group projects develop teamwork skills',
      'The role of technology in the modern classroom',
      'Why some students choose gap years before university',
      'How different countries approach homework and exams',
      'Peer tutoring and how students help each other learn',
    ],
  },
  {
    name: 'Health & Wellbeing',
    topics: [
      'The benefits of regular physical exercise',
      'How to maintain a healthy diet on a budget',
      'The importance of sleep for students',
      'Mental health awareness in schools',
      'How meditation and mindfulness reduce stress',
      'The effects of screen time on health',
      'First aid basics everyone should know',
      'How volunteering improves mental health',
      'Traditional medicine vs modern medicine',
      'How to manage stress during exam season',
      'The benefits of spending time in nature for health',
      'Understanding common allergies and how to manage them',
      'How regular health check-ups can prevent serious illness',
      'The role of laughter and humor in staying healthy',
      'Simple stretches and exercises for people who sit all day',
      'How drinking enough water affects your energy and mood',
    ],
  },
  {
    name: 'Technology & Digital Life',
    topics: [
      'How smartphones have changed daily life',
      'The internet of things — smart homes explained',
      'Artificial intelligence in everyday life',
      'How social media affects communication',
      'Cybersecurity — staying safe online',
      'The invention that changed the world the most',
      'The rise of video calling and how it changed social life',
      'How streaming services recommend what to watch',
      'The pros and cons of using voice assistants at home',
      'How online reviews influence our decisions',
      'Digital detox — why some people choose to disconnect',
      'The future of wearable technology',
      'How translation apps are breaking language barriers',
      'Learning new skills through YouTube and online tutorials',
      'How cloud storage has changed the way we save files',
      'The debate over screen time limits for children',
      'How QR codes became part of everyday life',
    ],
  },
  {
    name: 'Environment & Nature',
    topics: [
      'Protecting endangered species',
      'The problem of plastic pollution in oceans',
      'Urban gardens and green spaces in cities',
      'How deforestation affects the planet',
      'Recycling — does it really make a difference?',
      'Animals that have adapted to city life',
      'The effects of climate change on farming',
      'National parks and why they are important',
      'How individuals can reduce their carbon footprint',
      'The amazing migration journeys of animals',
      'Clean water access around the world',
      'How electric cars work and why they matter',
      'Renewable energy sources and their future',
      'The role of bees and pollinators in our food supply',
      'How composting reduces waste and helps the environment',
      'The impact of fast fashion on the planet',
    ],
  },
  {
    name: 'Culture & Entertainment',
    topics: [
      'The impact of streaming services on entertainment',
      'Traditional festivals around the world',
      'How music brings people together',
      'Street art — vandalism or art?',
      'How board games are making a comeback',
      'The rise of podcasts as entertainment',
      'Museums of the future — interactive and digital',
      'A book or film that changed someone\'s perspective',
      'How video games have become a form of storytelling',
      'The growing popularity of K-pop and Korean culture worldwide',
      'How comedy differs across cultures',
      'The role of dance in celebrating traditions',
      'Why people enjoy watching reality TV shows',
      'How fan communities shape popular culture',
      'The revival of vinyl records and retro trends',
      'Celebrations and coming-of-age traditions in different cultures',
    ],
  },
  {
    name: 'Shopping & Consumer',
    topics: [
      'Online shopping vs in-store shopping',
      'How to spot a good deal and avoid scams',
      'The rise of second-hand and vintage shopping',
      'Product reviews — can you trust them?',
      'How supermarkets influence what we buy',
      'The popularity of subscription box services',
      'Ethical consumerism — buying with a conscience',
      'How advertising targets young people',
      'Comparing different smartphone brands',
      'The zero-waste shopping movement',
      'Sustainable fashion and its growing popularity',
      'The influence of fashion on identity',
      'How loyalty programs and reward points affect spending habits',
      'The psychology behind impulse buying',
      'Why some people prefer buying local products',
      'How social media influencers affect what people buy',
    ],
  },
  {
    name: 'Community & Services',
    topics: [
      'How public libraries serve their communities',
      'Joining a local sports club or gym',
      'Community volunteering opportunities',
      'How to register for a local course or workshop',
      'Public transport improvements in your city',
      'The role of community centers in neighborhoods',
      'How to report a problem to local authorities',
      'Emergency services and how they work',
      'Neighborhood watch programs and safety',
      'How charities and NGOs make a difference',
      'How community gardens bring neighbors together',
      'The role of local markets and fairs in small towns',
      'How to find and use public health services',
      'Why community clean-up days matter',
      'The importance of accessible public spaces for everyone',
      'How local newspapers and websites keep communities informed',
    ],
  },
  {
    name: 'Current Events & Society',
    topics: [
      'The global rise of remote work after the pandemic',
      'How young people are addressing climate change',
      'The debate about social media regulation',
      'Immigration and cultural diversity in modern cities',
      'Gender equality progress around the world',
      'The future of transportation — flying cars and hyperloops',
      'How fake news spreads and how to identify it',
      'The growing gap between rich and poor',
      'Digital privacy and data protection',
      'How cities are preparing for population growth',
      'The impact of aging populations on society',
      'How public opinion shapes government decisions',
      'The role of protests and movements in social change',
      'Why voter participation matters in a democracy',
      'How different generations view work and success differently',
      'The ethics of surveillance cameras in public spaces',
    ],
  },

  // --- New Categories ---
  {
    name: 'Food & Cooking',
    topics: [
      'Learning to cook a traditional family recipe',
      'The best street food markets around the world',
      'The growing popularity of plant-based diets',
      'Common myths about nutrition and dieting',
      'How food reflects culture and history',
      'A beginner\'s guide to meal planning for the week',
      'How school lunch programs differ around the world',
      'The rise of food delivery apps and how they changed eating habits',
      'Understanding food labels and what they really mean',
      'Why cooking at home is making a comeback',
      'The science behind why certain flavors go together',
      'How seasonal eating benefits health and the environment',
      'Famous dishes from around the world and their origins',
      'The story behind a popular local restaurant',
      'How to eat well on a student budget',
      'The growing trend of cooking shows and food blogs',
      'Food waste and simple ways to reduce it at home',
    ],
  },
  {
    name: 'Sports & Fitness',
    topics: [
      'The history of a popular sport',
      'Sports injuries and how to prevent them',
      'How the Olympic Games bring nations together',
      'The benefits of team sports for young people',
      'Running a marathon — training, preparation, and race day',
      'How technology is changing the way athletes train',
      'The growing popularity of yoga and pilates',
      'Famous athletes who overcame adversity',
      'Why walking is one of the best forms of exercise',
      'The debate about paying college athletes',
      'How extreme sports attract a new generation of fans',
      'The role of sports in building school spirit',
      'Women\'s sports and the fight for equal coverage',
      'How swimming and water sports benefit overall fitness',
      'The rise of e-sports and competitive gaming',
      'How cycling is becoming a popular commuting choice',
      'The importance of warm-up and cool-down routines',
    ],
  },
  {
    name: 'History & Heritage',
    topics: [
      'How ancient civilizations shaped the modern world',
      'A famous historical figure who changed society',
      'The story behind a well-known national holiday',
      'How museums preserve and share our history',
      'The discovery of an important archaeological site',
      'Life in a medieval town — what was it really like?',
      'How the printing press revolutionized communication',
      'The history of public education in different countries',
      'Famous explorers and the journeys that changed maps',
      'How old photographs help us understand the past',
      'The history of a famous building or monument',
      'How traditional crafts and skills are being preserved',
      'The story of a city that was rebuilt after a disaster',
      'Important inventions from the Industrial Revolution',
      'How oral traditions keep history alive in different cultures',
      'The history of money — from coins to digital payments',
      'How wartime innovations led to everyday technologies',
    ],
  },
  {
    name: 'Science & Discovery',
    topics: [
      'The science behind climate change',
      'Space exploration — past achievements and future goals',
      'How 3D printing is used in medicine',
      'The water cycle and why it matters',
      'How scientists discover new species in remote places',
      'The basics of DNA and why it matters for medicine',
      'How weather forecasting has improved over the decades',
      'Simple science experiments you can do at home',
      'The story behind a Nobel Prize-winning discovery',
      'How volcanoes and earthquakes shape the landscape',
      'The role of robots in modern scientific research',
      'Why the ocean floor is still largely unexplored',
      'How vaccines work and why they are important',
      'The science of sleep and why dreams happen',
      'How light pollution affects animals and the night sky',
      'The search for life on other planets',
      'How recycling technology is evolving',
    ],
  },
  {
    name: 'Money & Finance',
    topics: [
      'How to create and stick to a monthly budget',
      'The basics of opening and managing a bank account',
      'Understanding credit cards and how interest works',
      'How different countries use different currencies',
      'Saving money as a student — practical tips',
      'The rise of mobile payment apps and digital wallets',
      'How inflation affects everyday shopping',
      'Understanding your first paycheck — taxes and deductions',
      'The pros and cons of borrowing money',
      'How to compare prices and find the best deals',
      'Why financial literacy should be taught in schools',
      'The basics of investing for beginners',
      'How tipping customs vary around the world',
      'Planning financially for a gap year or long trip',
      'The sharing economy — renting instead of buying',
      'How online banking has changed personal finance',
      'The cost of living in different cities around the world',
    ],
  },
  {
    name: 'Family & Relationships',
    topics: [
      'A memorable family gathering',
      'How family traditions are passed down through generations',
      'The challenges and rewards of being an older sibling',
      'How friendships change as people grow older',
      'Long-distance relationships in the age of technology',
      'The role of grandparents in family life',
      'How pets become part of the family',
      'Dealing with disagreements among friends',
      'The importance of communication in relationships',
      'How different cultures celebrate weddings',
      'The challenges of making new friends as an adult',
      'Growing up in a bilingual or multicultural family',
      'How shared hobbies strengthen friendships',
      'The changing role of parents in modern society',
      'Maintaining friendships when moving to a new city',
      'How acts of kindness strengthen community bonds',
      'The value of saying thank you and showing appreciation',
    ],
  },
  {
    name: 'Arts & Creativity',
    topics: [
      'Famous buildings and their stories',
      'How street murals transform neighborhoods',
      'The creative process behind writing a novel',
      'Why art therapy is used to help people heal',
      'How photography has changed since the invention of smartphones',
      'The history of a famous painting and what it represents',
      'How graphic design shapes the brands we recognize',
      'The role of music education in child development',
      'How theater and drama build confidence in students',
      'The growing trend of DIY crafts and handmade gifts',
      'How architecture reflects a city\'s culture and values',
      'The influence of animation and cartoons across generations',
      'How public art installations change the way we see cities',
      'Learning a musical instrument as an adult',
      'How creative writing can help people express their feelings',
      'The debate over whether AI can create real art',
    ],
  },
];

// --- Helper Functions ---

/** Get all reading topics */
export function getAllReadingTopics(): string[] {
  return READING_TOPIC_CATEGORIES.flatMap(cat => cat.topics);
}

/** Get a random reading topic, optionally excluding the current one */
export function getRandomReadingTopic(exclude?: string): string {
  const pool = getAllReadingTopics();
  if (pool.length === 0) return '';
  if (pool.length === 1) return pool[0];
  let topic = pool[Math.floor(Math.random() * pool.length)];
  while (topic === exclude) {
    topic = pool[Math.floor(Math.random() * pool.length)];
  }
  return topic;
}

/** Get a random reading genre */
export function getRandomReadingGenre(): ReadingGenre {
  return READING_GENRES[Math.floor(Math.random() * READING_GENRES.length)];
}

/** Get a random genre, avoiding the current one */
export function shuffleReadingGenre(excludeId?: string): ReadingGenre {
  if (READING_GENRES.length <= 1) return READING_GENRES[0];
  let genre = READING_GENRES[Math.floor(Math.random() * READING_GENRES.length)];
  while (genre.id === excludeId) {
    genre = READING_GENRES[Math.floor(Math.random() * READING_GENRES.length)];
  }
  return genre;
}

/** Get a genre by its ID */
export function getReadingGenreById(id: string): ReadingGenre | undefined {
  return READING_GENRES.find(g => g.id === id);
}

/** Get a random topic compatible with the given genre */
export function getCompatibleReadingTopic(genre: ReadingGenre, exclude?: string): string {
  const pool = genre.compatibleCategories
    ? READING_TOPIC_CATEGORIES
        .filter(cat => genre.compatibleCategories!.includes(cat.name))
        .flatMap(cat => cat.topics)
    : getAllReadingTopics();
  if (pool.length === 0) return getRandomReadingTopic(exclude);
  if (pool.length === 1) return pool[0];
  let topic = pool[Math.floor(Math.random() * pool.length)];
  while (topic === exclude) topic = pool[Math.floor(Math.random() * pool.length)];
  return topic;
}

/** Check if a topic is compatible with a genre */
export function isReadingTopicCompatible(genre: ReadingGenre, topic: string): boolean {
  if (!genre.compatibleCategories) return true;
  return READING_TOPIC_CATEGORIES
    .filter(cat => genre.compatibleCategories!.includes(cat.name))
    .some(cat => cat.topics.includes(topic));
}

/** Get a random genre compatible with the current topic */
export function getCompatibleReadingGenre(topic: string): ReadingGenre {
  const topicCategory = READING_TOPIC_CATEGORIES.find(cat => cat.topics.includes(topic));
  const pool = READING_GENRES.filter(g =>
    !g.compatibleCategories || (topicCategory && g.compatibleCategories.includes(topicCategory.name))
  );
  return pool.length > 0
    ? pool[Math.floor(Math.random() * pool.length)]
    : getRandomReadingGenre();
}
