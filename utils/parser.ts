import { DialogueAnalysis, SpeakerSegment } from '../types';

const MALE_NAMES = new Set([
  'john', 'james', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles', 
  'christopher', 'daniel', 'matthew', 'anthony', 'donald', 'mark', 'paul', 'steven', 'andrew', 'kenneth', 
  'joshua', 'george', 'kevin', 'brian', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 
  'jacob', 'gary', 'nicholas', 'eric', 'stephen', 'jonathan', 'larry', 'justin', 'scott', 'brandon', 
  'benjamin', 'samuel', 'frank', 'gregory', 'raymond', 'alexander', 'patrick', 'jack', 'dennis', 'jerry',
  'adam', 'harry', 'tyler', 'aaron', 'jose', 'henry', 'douglas', 'peter', 'zachary', 'nathan', 'walter',
  'kyle', 'harold', 'carl', 'jeremy', 'keith', 'roger', 'gerald', 'ethan', 'arthur', 'terry', 'christian', 
  'sean', 'lawrence', 'austin', 'joe', 'noah', 'jesse', 'albert', 'billy', 'bruce', 'willie', 'jordan', 
  'dylan', 'alan', 'ralph', 'gabriel', 'roy', 'juan', 'wayne', 'eugene', 'logan', 'randy', 'louis', 
  'russell', 'vincent', 'philip', 'bobby', 'johnny', 'bradley', 'mike', 'matt', 'chris', 'alex', 'sam', 
  'tom', 'dave', 'steve', 'jim', 'dan', 'tim', 'bob', 'bill', 'ron', 'jeff', 'greg', 'ken', 'puck', 'charon', 'fenrir'
]);

const FEMALE_NAMES = new Set([
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah', 'karen', 
  'nancy', 'lisa', 'betty', 'margaret', 'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle', 
  'dorothy', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia', 
  'kathleen', 'amy', 'shirley', 'angela', 'helen', 'anna', 'brenda', 'pamela', 'nicole', 'samantha', 
  'katherine', 'emma', 'ruth', 'christine', 'catherine', 'debra', 'rachel', 'carolyn', 'janet', 'virginia', 
  'maria', 'heather', 'diane', 'julie', 'joyce', 'victoria', 'olivia', 'kelly', 'christina', 'lauren', 
  'joan', 'evelyn', 'judith', 'megan', 'cheryl', 'andrea', 'hannah', 'martha', 'jacqueline', 'frances', 
  'gloria', 'ann', 'teresa', 'kathryn', 'sara', 'janice', 'jean', 'alice', 'madison', 'julia', 'grace', 
  'judy', 'abigail', 'marie', 'denise', 'beverly', 'amber', 'theresa', 'marilyn', 'danielle', 'diana', 
  'brittany', 'natalie', 'sophia', 'rose', 'kayla', 'alexis', 'jane', 'liz', 'deb', 'cathy', 'katie', 
  'beth', 'jen', 'kore', 'zephyr', 'mom', 'mother', 'grandma', 'aunt', 'sister', 'queen', 'lady', 'madam'
]);

export const guessGender = (name: string): 'Male' | 'Female' | 'Neutral' => {
  const n = name.toLowerCase().trim();
  const firstName = n.split(/\s+/)[0].replace(/[^a-z]/g, ''); // Extract first word, remove punctuation
  
  // Explicit Titles/Honorifics (Regex for safety)
  if (/\b(mr|mr\.|sir|king|lord|father|dad|grandpa|brother|uncle|boy|male|guy|man)\b/.test(n)) return 'Male';
  if (/\b(mrs|mrs\.|ms|ms\.|miss|lady|queen|mother|mom|grandma|sister|aunt|girl|female|woman|madam)\b/.test(n)) return 'Female';

  // Strict Name Matching (First Name)
  if (FEMALE_NAMES.has(firstName)) return 'Female';
  if (MALE_NAMES.has(firstName)) return 'Male';

  return 'Neutral';
};

export const parseDialogue = (text: string): DialogueAnalysis => {
  const lines = text.split('\n');
  const segments: SpeakerSegment[] = [];
  const speakers = new Set<string>();
  
  // Regex to look for "Name: Message" pattern
  // Matches "John:", "Speaker 1:", "MR. SMITH:"
  const dialogueRegex = /^([A-Za-z0-9\s_.-]+):\s+(.*)/;

  let currentSpeaker = 'Narrator';
  let hasDialogueFormat = false;

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const match = trimmedLine.match(dialogueRegex);

    if (match) {
      hasDialogueFormat = true;
      const detectedSpeaker = match[1].trim();
      const content = match[2].trim();
      
      currentSpeaker = detectedSpeaker;
      speakers.add(detectedSpeaker);
      
      if (content) {
        segments.push({ speaker: detectedSpeaker, text: content });
      }
    } else {
      // Continuation of previous speaker or general narration
      // If we haven't found any dialogue tags yet, assume it's narration
      if (segments.length === 0 && !hasDialogueFormat) {
        speakers.add('Narrator');
      }
      
      segments.push({ speaker: currentSpeaker, text: trimmedLine });
    }
  });

  const uniqueSpeakers = Array.from(speakers);

  return {
    isDialogue: uniqueSpeakers.length > 1 || (uniqueSpeakers.length === 1 && uniqueSpeakers[0] !== 'Narrator'),
    speakers: uniqueSpeakers,
    segments
  };
};