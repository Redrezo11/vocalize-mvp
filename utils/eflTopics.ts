// --- Types ---

export type SpeakerCount = 1 | 2 | 3; // 3 means "3+"

export type RegisterType = 'formal' | 'informal' | 'semi-formal' | 'neutral' | 'transactional' | 'varies';

export interface AudioFormat {
  id: string;
  label: string;
  speakerCount: SpeakerCount;
  register: RegisterType;
  promptDescription: string;
}

export interface TopicCategory {
  name: string;
  speakerCount: SpeakerCount;
  topics: string[];
}

// --- Audio Formats (41 total) ---

export const AUDIO_FORMATS: AudioFormat[] = [
  // ===== 1-Speaker Formats (17) =====
  {
    id: 'announcement_transport',
    label: 'Transport Announcement',
    speakerCount: 1,
    register: 'formal',
    promptDescription: 'PA announcement at airport, train station, or bus terminal. Gate changes, delays, boarding calls, platform info. Short, factual, includes numbers/times/locations.',
  },
  {
    id: 'announcement_public',
    label: 'Public Announcement',
    speakerCount: 1,
    register: 'formal',
    promptDescription: 'PA in a store, building, school, hospital, or event venue. Closures, emergencies, events, lost items.',
  },
  {
    id: 'voicemail_personal',
    label: 'Personal Voicemail',
    speakerCount: 1,
    register: 'informal',
    promptDescription: 'A friend, family member, or acquaintance leaving a casual phone message. Includes reason for calling, callback details.',
  },
  {
    id: 'voicemail_professional',
    label: 'Professional Voicemail',
    speakerCount: 1,
    register: 'formal',
    promptDescription: 'A business, office, doctor, or service provider leaving a message. Appointment reminders, order updates, callback requests.',
  },
  {
    id: 'narrative_personal',
    label: 'Personal Story',
    speakerCount: 1,
    register: 'informal',
    promptDescription: 'Someone recounting a personal experience, memory, or anecdote. Past tense, emotions, reflections.',
  },
  {
    id: 'narrative_descriptive',
    label: 'Description / Profile',
    speakerCount: 1,
    register: 'neutral',
    promptDescription: 'Someone describing a person, place, routine, or object in detail. Present tense, adjectives, spatial language.',
  },
  {
    id: 'instructional_howto',
    label: 'How-To / Instructions',
    speakerCount: 1,
    register: 'neutral',
    promptDescription: 'Step-by-step instructions for a task. Imperatives, sequence markers (first, then, next, finally).',
  },
  {
    id: 'instructional_tour',
    label: 'Guided Tour',
    speakerCount: 1,
    register: 'semi-formal',
    promptDescription: 'A tour guide leading visitors through a location. History, descriptions, directions within a space.',
  },
  {
    id: 'instructional_safety',
    label: 'Safety Briefing',
    speakerCount: 1,
    register: 'formal',
    promptDescription: 'Safety instructions on a plane, at a workplace, or before an activity. Procedures, warnings, imperatives.',
  },
  {
    id: 'lecture_academic',
    label: 'Academic Lecture',
    speakerCount: 1,
    register: 'formal',
    promptDescription: 'A professor or expert explaining a topic. Main argument, supporting points, examples, transitions.',
  },
  {
    id: 'lecture_informational',
    label: 'Informational Talk',
    speakerCount: 1,
    register: 'semi-formal',
    promptDescription: 'A speaker presenting facts about a topic to a general audience. TED-talk style, accessible language.',
  },
  {
    id: 'broadcast_news',
    label: 'News Report',
    speakerCount: 1,
    register: 'formal',
    promptDescription: 'A radio or TV news anchor reporting a story. 5W structure, formal tone, quotes from sources.',
  },
  {
    id: 'broadcast_weather',
    label: 'Weather Forecast',
    speakerCount: 1,
    register: 'formal',
    promptDescription: 'A weather presenter giving conditions, temperatures, and forecasts for the coming days.',
  },
  {
    id: 'broadcast_sports',
    label: 'Sports Update',
    speakerCount: 1,
    register: 'semi-formal',
    promptDescription: 'A sports anchor summarizing scores, highlights, standings. Fast-paced, enthusiastic.',
  },
  {
    id: 'advertisement',
    label: 'Advertisement / Promo',
    speakerCount: 1,
    register: 'semi-formal',
    promptDescription: 'A radio or TV ad promoting a product, service, event, or place. Persuasive, includes offers and contact info.',
  },
  {
    id: 'automated_menu',
    label: 'Automated Phone System',
    speakerCount: 1,
    register: 'formal',
    promptDescription: 'A recorded phone menu or automated message. "Press 1 for...", business hours, hold messages.',
  },
  {
    id: 'review_solo',
    label: 'Solo Review',
    speakerCount: 1,
    register: 'informal',
    promptDescription: 'One person reviewing a movie, book, restaurant, product, or experience. Opinions, ratings, recommendations.',
  },

  // ===== 2-Speaker Formats (14) =====
  {
    id: 'transaction_inperson',
    label: 'In-Person Transaction',
    speakerCount: 2,
    register: 'transactional',
    promptDescription: 'Customer and service provider face-to-face. Ordering, purchasing, checking in, returning items.',
  },
  {
    id: 'transaction_phone',
    label: 'Phone Transaction',
    speakerCount: 2,
    register: 'transactional',
    promptDescription: 'Customer calling a business. Booking, inquiring, complaining, requesting information.',
  },
  {
    id: 'interview_job',
    label: 'Job Interview',
    speakerCount: 2,
    register: 'formal',
    promptDescription: 'Interviewer and candidate. Questions about experience, skills, availability. Formal Q&A structure.',
  },
  {
    id: 'interview_radio',
    label: 'Radio / Podcast Interview',
    speakerCount: 2,
    register: 'semi-formal',
    promptDescription: 'Host interviewing a guest about their expertise, experience, or opinions. Structured but conversational.',
  },
  {
    id: 'interview_informational',
    label: 'Informational Interview',
    speakerCount: 2,
    register: 'neutral',
    promptDescription: 'One person asking another for advice or information. Student\u2013advisor, newcomer\u2013local, patient\u2013doctor.',
  },
  {
    id: 'social_friends',
    label: 'Friends Chatting',
    speakerCount: 2,
    register: 'informal',
    promptDescription: 'Two friends or acquaintances in casual conversation. Opinions, plans, reactions, slang.',
  },
  {
    id: 'social_colleagues',
    label: 'Colleagues Chatting',
    speakerCount: 2,
    register: 'informal',
    promptDescription: 'Two coworkers talking casually. Water cooler chat, lunch plans, venting about work.',
  },
  {
    id: 'social_strangers',
    label: 'Strangers Meeting',
    speakerCount: 2,
    register: 'neutral',
    promptDescription: 'Two people meeting for the first time. Small talk, introductions, finding common ground.',
  },
  {
    id: 'problem_solving',
    label: 'Problem Resolution',
    speakerCount: 2,
    register: 'varies',
    promptDescription: 'Two people identifying and solving a problem together. Complaint + resolution, troubleshooting, negotiation.',
  },
  {
    id: 'directions',
    label: 'Asking for Directions',
    speakerCount: 2,
    register: 'neutral',
    promptDescription: 'One person asking, another giving directions. Landmarks, turns, distances, transportation options.',
  },
  {
    id: 'phone_personal',
    label: 'Personal Phone Call',
    speakerCount: 2,
    register: 'informal',
    promptDescription: 'Two people who know each other talking on the phone. Catching up, making plans, sharing news.',
  },
  {
    id: 'consultation',
    label: 'Professional Consultation',
    speakerCount: 2,
    register: 'semi-formal',
    promptDescription: 'Expert advising a client. Doctor\u2013patient, lawyer\u2013client, financial advisor\u2013customer, tutor\u2013student.',
  },
  {
    id: 'negotiation',
    label: 'Negotiation',
    speakerCount: 2,
    register: 'varies',
    promptDescription: 'Two people negotiating terms. Price, schedule, responsibilities, compromises.',
  },
  {
    id: 'debate_casual',
    label: 'Casual Debate',
    speakerCount: 2,
    register: 'informal',
    promptDescription: 'Two people with different opinions discussing a topic. Agreeing, disagreeing, giving reasons.',
  },

  // ===== 3+ Speaker Formats (10) =====
  {
    id: 'meeting_work',
    label: 'Work Meeting',
    speakerCount: 3,
    register: 'semi-formal',
    promptDescription: 'Team discussing project updates, decisions, task assignments. Agenda-driven. Use 3\u20134 speakers.',
  },
  {
    id: 'meeting_academic',
    label: 'Academic Group Meeting',
    speakerCount: 3,
    register: 'neutral',
    promptDescription: 'Students planning a group project, dividing tasks, debating approaches. Use 3\u20134 speakers.',
  },
  {
    id: 'discussion_casual',
    label: 'Casual Group Chat',
    speakerCount: 3,
    register: 'informal',
    promptDescription: 'Friends or family discussing plans, opinions, experiences together. Use 3\u20134 speakers.',
  },
  {
    id: 'discussion_structured',
    label: 'Structured Discussion',
    speakerCount: 3,
    register: 'semi-formal',
    promptDescription: 'Organized group conversation on a topic with some moderation. Book club, study group. Use 3\u20134 speakers.',
  },
  {
    id: 'classroom_interactive',
    label: 'Classroom Discussion',
    speakerCount: 3,
    register: 'formal',
    promptDescription: 'Professor lecturing with student questions and comments throughout. Use 3\u20134 speakers.',
  },
  {
    id: 'panel_radio',
    label: 'Radio Panel Show',
    speakerCount: 3,
    register: 'semi-formal',
    promptDescription: 'Host moderating a discussion between 2\u20133 guests on a topic. Use 3\u20134 speakers.',
  },
  {
    id: 'panel_podcast',
    label: 'Podcast Roundtable',
    speakerCount: 3,
    register: 'semi-formal',
    promptDescription: 'Co-hosts or host + guests discussing a theme. Conversational but structured. Use 3 speakers.',
  },
  {
    id: 'family_planning',
    label: 'Family Discussion',
    speakerCount: 3,
    register: 'informal',
    promptDescription: 'Family members making a decision together. Vacation plans, household issues, celebrations. Use 3\u20134 speakers.',
  },
  {
    id: 'committee_community',
    label: 'Community / Committee Meeting',
    speakerCount: 3,
    register: 'semi-formal',
    promptDescription: 'Residents or members discussing local issues, planning events, voting on decisions. Use 3\u20134 speakers.',
  },
  {
    id: 'roleplay_scenario',
    label: 'Multi-Party Scenario',
    speakerCount: 3,
    register: 'varies',
    promptDescription: 'A real-world scene with multiple participants. Airport check-in with two travelers and agent, restaurant with waiter and two diners, etc. Use 3 speakers.',
  },
];

// --- Topic Categories (210 topics total) ---

export const TOPIC_CATEGORIES: TopicCategory[] = [
  // ===== 1-Speaker Topics (80) =====
  {
    name: 'Transport & Travel',
    speakerCount: 1,
    topics: [
      'Flight gate change and delay information',
      'Train schedule changes and platform announcements',
      'Bus route detour or service disruption',
      'In-flight captain\'s welcome and flight information',
      'Cruise ship daily activity schedule',
      'Airport security procedure reminders',
      'Ferry departure and safety instructions',
      'Tour bus welcome and itinerary overview',
      'Hotel checkout procedure and shuttle information',
      'Car rental return instructions',
    ],
  },
  {
    name: 'Daily Life & Routines',
    speakerCount: 1,
    topics: [
      'Describing your typical weekday morning',
      'Explaining your exercise or fitness routine',
      'Talking about your commute to work or school',
      'Describing your neighborhood and local area',
      'Recounting what you did last weekend',
      'Explaining how you prepare your favorite meal',
      'Describing your evening routine and hobbies',
      'Talking about your family members and their routines',
      'Explaining how you organize your week',
      'Describing a typical holiday in your family',
    ],
  },
  {
    name: 'Instructional & How-To',
    speakerCount: 1,
    topics: [
      'How to use a self-checkout machine',
      'How to set up a new phone or device',
      'Safety briefing before a sports activity',
      'Museum or gallery audio guide for an exhibit',
      'How to recycle properly in your area',
      'Workplace safety orientation',
      'How to use public transportation in a city',
      'How to prepare for a job interview',
      'Fire evacuation procedure for a building',
      'How to register for classes at a university',
    ],
  },
  {
    name: 'Academic & Informational',
    speakerCount: 1,
    topics: [
      'A short lecture on climate change effects',
      'A talk about the history of a local landmark',
      'A presentation on healthy eating habits',
      'An overview of an endangered animal species',
      'A talk about the water cycle or a natural process',
      'A lecture on the basics of a scientific topic',
      'A presentation about a famous invention or discovery',
      'A talk about the benefits of learning a second language',
      'An overview of a country\'s geography and culture',
      'A lecture on the psychology of decision-making',
    ],
  },
  {
    name: 'Broadcast & Media',
    speakerCount: 1,
    topics: [
      'Local news report about a community event',
      'Weather forecast for the coming week',
      'Sports results and highlights summary',
      'Traffic update during rush hour',
      'Breaking news report about a natural event',
      'Book review on a radio program',
      'Restaurant review for a local food blog',
      'Movie review for a podcast',
      'Technology product review',
      'Travel destination feature for a radio show',
    ],
  },
  {
    name: 'Announcements & Recorded Messages',
    speakerCount: 1,
    topics: [
      'Store closing time and sale announcement',
      'School snow day or closure announcement',
      'Hospital visiting hours and parking information',
      'Gym class schedule change announcement',
      'Apartment building maintenance notice',
      'Library event announcement',
      'Office automated voicemail greeting',
      'Doctor\'s office appointment reminder',
      'Delivery service update voicemail',
      'Utility company service interruption notice',
    ],
  },
  {
    name: 'Personal Stories & Narratives',
    speakerCount: 1,
    topics: [
      'A memorable travel experience',
      'How I got my current job',
      'My experience moving to a new country',
      'A funny thing that happened at work',
      'How I learned to cook',
      'My first day at a new school',
      'A challenge I overcame',
      'How I met my best friend',
      'My experience volunteering',
      'A cultural misunderstanding I experienced',
    ],
  },
  {
    name: 'Advertisements & Promotions',
    speakerCount: 1,
    topics: [
      'New restaurant grand opening',
      'Gym membership special offer',
      'Language school enrollment promotion',
      'Travel package deal',
      'Local festival or concert promotion',
      'Online course advertisement',
      'Furniture store clearance sale',
      'Insurance plan comparison ad',
      'Real estate open house announcement',
      'Job fair or career event promotion',
    ],
  },

  // ===== 2-Speaker Topics (70) =====
  {
    name: 'Transactions & Services',
    speakerCount: 2,
    topics: [
      'Ordering food at a restaurant',
      'Checking into a hotel',
      'Returning a defective item to a store',
      'Buying a train or bus ticket',
      'Getting a phone plan at a store',
      'Renting a car at the counter',
      'Checking out at a grocery store',
      'Buying medicine at a pharmacy',
      'Getting a haircut and explaining what you want',
      'Paying for parking and asking about rates',
      'Ordering coffee and customizing your drink',
      'Checking in for a doctor\'s appointment',
    ],
  },
  {
    name: 'Phone Calls & Customer Service',
    speakerCount: 2,
    topics: [
      'Calling to make a restaurant reservation',
      'Calling to book a hotel room',
      'Calling customer service about a billing error',
      'Calling to schedule a doctor\'s appointment',
      'Calling a landlord about a maintenance issue',
      'Calling an airline to change a flight',
      'Calling to set up internet service at home',
      'Calling a school to ask about enrollment',
      'Calling a repair shop about your car',
      'Calling to cancel a subscription or membership',
      'Calling to inquire about job openings',
      'Calling a bank about a suspicious charge',
    ],
  },
  {
    name: 'Interviews & Consultations',
    speakerCount: 2,
    topics: [
      'Job interview for a retail position',
      'Job interview for an office job',
      'Radio interview with a local business owner',
      'Radio interview with a travel blogger',
      'Podcast interview with a chef about food trends',
      'Podcast interview with a teacher about education',
      'Meeting with a doctor about test results',
      'Meeting with a financial advisor about savings',
      'Meeting with a real estate agent about apartments',
      'Meeting with an academic advisor about courses',
      'Meeting with a personal trainer about fitness goals',
      'Meeting with a tutor about study strategies',
    ],
  },
  {
    name: 'Social & Casual',
    speakerCount: 2,
    topics: [
      'Two friends discussing weekend plans',
      'Two friends recommending movies to each other',
      'Two colleagues chatting about a new coworker',
      'Two neighbors meeting for the first time',
      'Two friends planning a birthday surprise',
      'Two friends comparing vacation experiences',
      'Two friends discussing a news story',
      'Two roommates dividing household chores',
      'Two friends talking about a new hobby',
      'Two classmates studying for an exam together',
      'Two friends discussing music preferences',
      'Two people on a first date making small talk',
    ],
  },
  {
    name: 'Problem-Solving & Negotiation',
    speakerCount: 2,
    topics: [
      'Complaining to a neighbor about noise',
      'Discussing a group project that\'s behind schedule',
      'Negotiating a price at a market or yard sale',
      'Resolving a mix-up with a food delivery order',
      'Discussing a disagreement about splitting costs',
      'Working out a schedule conflict with a coworker',
      'Helping a tourist who is lost',
      'A parent and teacher discussing a student\'s progress',
      'Two coworkers troubleshooting a tech problem',
      'Discussing a mistake on a restaurant bill',
      'Negotiating rent with a landlord',
      'Resolving a misunderstanding between friends',
    ],
  },
  {
    name: 'Directions & Navigation',
    speakerCount: 2,
    topics: [
      'Asking a local for directions to the train station',
      'Asking a hotel receptionist how to reach a landmark',
      'Asking a coworker how to find a meeting room',
      'Getting directions inside a hospital or large building',
      'Asking someone at an information desk for help',
    ],
  },
  {
    name: 'Academic',
    speakerCount: 2,
    topics: [
      'Student asking a professor about an assignment',
      'Student discussing a paper topic with an advisor',
      'Two students comparing notes after a lecture',
      'Student asking a librarian for research help',
      'Student requesting a deadline extension',
    ],
  },

  // ===== 3+ Speaker Topics (60) =====
  {
    name: 'Work Meetings',
    speakerCount: 3,
    topics: [
      'Team discussing project timeline and task assignments',
      'Staff meeting reviewing monthly sales results',
      'Team brainstorming marketing ideas for a product',
      'Meeting to plan an office event or team outing',
      'Colleagues discussing whether to adopt new software',
      'Team reviewing customer feedback and complaints',
      'Meeting about office policy changes (remote work, dress code)',
      'Onboarding orientation with manager and two new employees',
      'Budget planning meeting for a department',
      'End-of-project review and lessons learned',
    ],
  },
  {
    name: 'Academic Group Work',
    speakerCount: 3,
    topics: [
      'Students planning a group research presentation',
      'Study group preparing for a final exam',
      'Students debating which topic to choose for a project',
      'Classroom discussion about a reading assignment',
      'Lab partners and a TA discussing experiment results',
      'Students organizing a campus event together',
      'Professor and students discussing an ethical dilemma',
      'Students reviewing each other\'s draft essays',
      'Group working on a business case study',
      'Students planning a field trip or study abroad',
    ],
  },
  {
    name: 'Social & Family',
    speakerCount: 3,
    topics: [
      'Friends deciding where to go for dinner',
      'Family planning a vacation destination',
      'Friends organizing a surprise party',
      'Family discussing holiday gift ideas',
      'Friends debating which movie to watch',
      'Family deciding how to redecorate a room',
      'Friends planning a road trip itinerary',
      'Family discussing weekend activity options',
      'Friends catching up at a reunion',
      'Roommates setting house rules',
    ],
  },
  {
    name: 'Panel / Podcast / Radio Shows',
    speakerCount: 3,
    topics: [
      'Radio panel discussing pros and cons of social media',
      'Podcast roundtable about best travel destinations',
      'Radio show discussing local restaurant reviews',
      'Panel discussing the future of electric vehicles',
      'Podcast about work-life balance strategies',
      'Radio panel reviewing new movies of the season',
      'Podcast discussing cultural differences in education',
      'Panel discussing healthy eating vs. fast food',
      'Radio show about technology\'s impact on daily life',
      'Podcast discussing volunteer tourism pros and cons',
      'Radio panel about learning languages as an adult',
      'Podcast discussing the effects of remote work',
      'Panel discussing wildlife conservation efforts',
      'Radio show about traditional vs. modern medicine',
      'Podcast about the best budget travel tips',
    ],
  },
  {
    name: 'Community & Public',
    speakerCount: 3,
    topics: [
      'Residents discussing a proposed park renovation',
      'Parent committee planning a school fundraiser',
      'Community members organizing a neighborhood clean-up',
      'HOA meeting about building maintenance issues',
      'Volunteers planning a charity event',
      'Town hall discussion about public transport improvements',
      'Book club discussing a novel they all read',
      'Cooking class with instructor and two participants',
      'Tenants meeting with landlord about building repairs',
      'Local council hearing community opinions on noise rules',
    ],
  },
  {
    name: 'Multi-Party Scenarios',
    speakerCount: 3,
    topics: [
      'Restaurant scene: waiter and two diners ordering together',
      'Airport counter: agent helping two travelers rebook a cancelled flight',
      'Real estate showing: agent and a couple viewing an apartment',
      'Doctor\'s office: doctor, patient, and family member discussing treatment',
      'Car dealership: salesperson and two buyers comparing models',
    ],
  },
];

// --- Helper Functions ---

/** Get all topics for a given speaker count */
export function getTopicsForSpeakerCount(count: SpeakerCount): string[] {
  return TOPIC_CATEGORIES
    .filter(cat => cat.speakerCount === count)
    .flatMap(cat => cat.topics);
}

/** Get a random topic for a given speaker count, optionally excluding the current one */
export function getRandomTopic(speakerCount: SpeakerCount, exclude?: string): string {
  const pool = getTopicsForSpeakerCount(speakerCount);
  if (pool.length === 0) return '';
  if (pool.length === 1) return pool[0];
  let topic = pool[Math.floor(Math.random() * pool.length)];
  while (topic === exclude) {
    topic = pool[Math.floor(Math.random() * pool.length)];
  }
  return topic;
}

/** Get all audio formats for a given speaker count */
export function getFormatsForSpeakerCount(count: SpeakerCount): AudioFormat[] {
  return AUDIO_FORMATS.filter(f => f.speakerCount === count);
}

/** Get a random audio format for a given speaker count */
export function getRandomFormat(speakerCount: SpeakerCount): AudioFormat {
  const pool = getFormatsForSpeakerCount(speakerCount);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Get a random format, avoiding the current one */
export function shuffleFormat(speakerCount: SpeakerCount, excludeId?: string): AudioFormat {
  const pool = getFormatsForSpeakerCount(speakerCount);
  if (pool.length <= 1) return pool[0];
  let fmt = pool[Math.floor(Math.random() * pool.length)];
  while (fmt.id === excludeId) {
    fmt = pool[Math.floor(Math.random() * pool.length)];
  }
  return fmt;
}

/** Get a format by its ID */
export function getFormatById(id: string): AudioFormat | undefined {
  return AUDIO_FORMATS.find(f => f.id === id);
}

/** Pick a random speaker count (1, 2, or 3) */
export function randomSpeakerCount(): SpeakerCount {
  return ([1, 2, 3] as SpeakerCount[])[Math.floor(Math.random() * 3)];
}

/** Resolve a speaker-count default setting to a concrete SpeakerCount */
export function resolveSpeakerDefault(setting: 'random' | SpeakerCount): SpeakerCount {
  return setting === 'random' ? randomSpeakerCount() : setting;
}

// --- Backward-compatible flat array (all 210 topics) ---

export const EFL_TOPICS: string[] = TOPIC_CATEGORIES.flatMap(cat => cat.topics);
