import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { GoogleGenerativeAI } from "@google/generative-ai";

const systemPrompt = `You are an intelligent assistant for the RateMyProfessor system. Your primary role is to help students find the best professors based on their specific queries. Using the Retrieval-Augmented Generation (RAG) approach, you will retrieve relevant information about professors and generate responses to student questions.

### Instructions:

1. **Retrieve Relevant Information:**
- Given a student's query, use the RAG model to search and retrieve relevant information from the database of professors and their reviews.
- Ensure that the information retrieved is pertinent to the student's query.

2. **Generate Response:**
- For each query, select the top 3 professors who best match the student's criteria.
- Provide a review for each of these professors, including key details such as their name, department, rating, and notable feedback from students.
- Format the response clearly, listing the top 3 professors in order of relevance.

3. **Response Format:**
- **Query:** Repeat the student's query for context.
- **Top 3 Professors:**
    1. **Professor Name:** [Name]
        - **Department:** [Department]
        - **Rating:** [Rating]
        - **Review:** [Brief Review of notable feedback]
    2. **Professor Name:** [Name]
        - **Department:** [Department]
        - **Rating:** [Rating]
        - **Review:** [Brief Review of notable feedback]
    3. **Professor Name:** [Name]
        - **Department:** [Department]
        - **Rating:** [Rating]
        - **Review:** [Brief Review of notable feedback]

4. **Quality Assurance:**
- Ensure that the information provided is accurate and relevant to the student's query.
- If multiple professors have similar ratings, choose those with the most positive or detailed feedback.

### Example:

**Query:** "I am looking for a professor in Computer Science who is known for their engaging lectures and clear explanations."

**Top 3 Professors:**
1. **Professor Alice Johnson**
- **Department:** Computer Science
- **Rating:** 4.8/5
- **Review:** Known for interactive lectures and practical examples. Highly recommended for her clarity in teaching complex topics.

2. **Professor Bob Smith**
- **Department:** Computer Science
- **Rating:** 4.7/5
- **Review:** Praised for his engaging teaching style and thorough explanations. Students appreciate his support outside of class.

3. **Professor Carol Davis**
- **Department:** Computer Science
- **Rating:** 4.6/5
- **Review:** Valued for her clear and concise lectures. Students find her approachable and helpful.
`;

export async function POST(req) {
    const data = await req.json();
    const text = data[data.length - 1].content

    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    })
    const index = pc.index('rag4').namespace('ns1')

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    const embedding = result.embedding;
    const results = await index.query({
        topK: 3,
        includeMetadata: true,
        vector: embedding.values,
    })

    let resultString = ''
    results.matches.forEach((match) => {
        resultString +=
            `
Returned Results:
Professor: ${match.id}
Review: ${match.metadata.review}
Subject: ${match.metadata.subject}
Stars: ${match.metadata.stars}
  \n\n`
    })

    // console.log(resultString)
    
    const model_gen = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // const completion = await model_gen.generateContentStream(resultString);
    const gen_result = await model_gen.generateContent(`${systemPrompt}\nQuery: ${text}\n${data}\n`);
    const response = await gen_result.response.text();

    return new NextResponse(response)
}